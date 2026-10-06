import type { Metadata } from "next";
import { AccountShell } from "@/components/account-shell";
import { NotificationsList } from "@/components/account/notifications-list";
import { requirePageUser } from "@/lib/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "اعلان‌ها | CaseLine", robots: { index: false } };

export default async function NotificationsPage() {
  await requirePageUser("/account/notifications");
  return <AccountShell active="notifications"><NotificationsList /></AccountShell>;
}
