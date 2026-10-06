import type { Metadata } from "next";
import { AccountShell } from "@/components/account-shell";
import { EditAccountForm } from "@/components/account/edit-form";
import { AddressesManager } from "@/components/account/addresses";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "اطلاعات حساب کاربری | CaseLine", robots: { index: false } };

export default async function EditAccountPage() {
  const user = await requirePageUser("/account/edit");
  const [row, addresses] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true, mustChangePassword: true } }),
    db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }),
  ]);
  // Profile completeness: shown as a simple progress card; nothing here is mandatory.
  const steps: [string, boolean][] = [["نام و نام خانوادگی", !!(user.firstName && user.lastName)], ["ایمیل", !!user.email], ["شماره موبایل", !!user.phone], ["آدرس", addresses.length > 0]];
  const done = steps.filter(([, ok]) => ok).length;
  return (
    <AccountShell active="edit">
      <div className="space-y-5">
        <section className="rounded-[16px] bg-surface-2 p-4" data-testid="completion">
          <div className="flex items-center justify-between gap-2 text-[13px]"><b>تکمیل اطلاعات حساب</b><span className="font-extrabold text-primary">{Math.round((done / steps.length) * 100).toLocaleString("fa-IR")}٪</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={Math.round((done / steps.length) * 100)} aria-valuemin={0} aria-valuemax={100}><i className="block h-full rounded-md bg-primary transition-all duration-500" style={{ width: `${(done / steps.length) * 100}%` }} /></div>
          <ul className="mt-3 flex flex-wrap gap-2 text-[11px]">{steps.map(([l, ok]) => <li key={l} className={`rounded-full px-2.5 py-1 font-bold ${ok ? "bg-success/15 text-success" : "bg-surface text-muted"}`}>{ok ? "✓" : "○"} {l}</li>)}</ul>
        </section>
        <EditAccountForm hasPassword={!!row.passwordHash} phone={user.phone} mustChange={row.mustChangePassword} init={{ firstName: user.firstName ?? "", lastName: user.lastName ?? "", displayName: user.displayName ?? "", email: user.email ?? "" }} />
        <AddressesManager initial={addresses.map((a) => ({ id: a.id, title: a.title, receiver: a.receiver, phone: a.phone, province: a.province, city: a.city, postalCode: a.postalCode, address: a.address, isDefault: a.isDefault }))} defaults={{ receiver: [user.firstName, user.lastName].filter(Boolean).join(" "), phone: user.phone ?? "" }} />
      </div>
    </AccountShell>
  );
}
