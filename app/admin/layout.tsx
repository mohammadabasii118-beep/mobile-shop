import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/auth/session";
import { AdminShell, type Notice } from "@/components/admin/shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "مدیریت | CaseLine", robots: { index: false, follow: false } };

const ROLE_NAMES: Record<string, string> = { super_admin: "مدیر ارشد", admin: "مدیر", product_manager: "مدیر محصول", order_manager: "مدیر سفارش", content_manager: "مدیر محتوا", support: "پشتیبان", wholesale_manager: "مدیر همکاران" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/account?next=/admin");
  if (!user.isStaff) {
    return (
      <main id="main" className="grid min-h-screen place-items-center p-6 text-center">
        <div><h1 className="text-2xl font-black">دسترسی ندارید</h1><p className="mt-2 text-sm text-muted">حساب شما اجازه ورود به پنل مدیریت را ندارد.</p><Link href="/" className="mt-4 inline-block text-primary">بازگشت به سایت</Link></div>
      </main>
    );
  }
  const has = (p: string) => user.permissions.includes(p);
  const [pay, ws, rv, low, rf, tk] = await Promise.all([
    has("payment.review") ? db.order.count({ where: { status: "PAYMENT_REVIEW" } }) : 0,
    has("wholesale.review") ? db.wholesaleApplication.count({ where: { status: "PENDING" } }) : 0,
    has("review.moderate") ? db.review.count({ where: { status: "pending" } }) : 0,
    has("inventory.write") ? db.$queryRaw<{ c: bigint }[]>`SELECT count(*) AS c FROM "Inventory" WHERE "quantity" <= "lowStockThreshold"`.then((r) => Number(r[0]?.c ?? 0)) : 0,
    has("refund.approve") ? db.refund.count({ where: { status: "PENDING_BANK" } }) : 0,
    has("support.read") || has("support.reply") ? db.supportTicket.count({ where: { status: "open" } }) : 0,
  ]);
  const notices: Notice[] = [
    { label: "پرداخت در انتظار بررسی", count: pay, href: "/admin/payments" },
    { label: "درخواست همکاری جدید", count: ws, href: "/admin/wholesale" },
    { label: "نظر در انتظار تأیید", count: rv, href: "/admin/reviews" },
    { label: "کالای کم‌موجودی", count: low, href: "/admin/inventory?low=1" },
    { label: "بازگشت وجه بانکی در انتظار واریز", count: rf, href: "/admin/refunds" },
    { label: "تیکت در انتظار پاسخ", count: tk, href: "/admin/support?status=open" },
  ].filter((n) => n.count > 0);
  return (
    <AdminShell user={{ name: user.displayName ?? user.phone, phone: user.phone, roles: user.roles.map((r) => ROLE_NAMES[r] ?? r) }} perms={user.permissions} notices={notices}>
      {children}
    </AdminShell>
  );
}
