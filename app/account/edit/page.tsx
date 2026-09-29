import type { Metadata } from "next";
import { AccountShell } from "@/components/account-shell";
import { EditAccountForm } from "@/components/account/edit-form";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "اطلاعات حساب کاربری | CaseLine", robots: { index: false } };

export default async function EditAccountPage() {
  const user = await requirePageUser("/account/edit");
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  return (
    <AccountShell active="edit">
      <EditAccountForm hasPassword={!!row.passwordHash} init={{ firstName: user.firstName ?? "", lastName: user.lastName ?? "", displayName: user.displayName ?? "", email: user.email ?? "" }} />
    </AccountShell>
  );
}
