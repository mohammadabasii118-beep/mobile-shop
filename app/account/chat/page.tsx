import type { Metadata } from "next";
import { AccountShell } from "@/components/account-shell";
import { ChatHome } from "@/components/account/chat";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/server/auth/guard";
import { faDate, orderNo } from "@/lib/account-format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "چت آنلاین | CaseLine", robots: { index: false } };

export default async function ChatPage() {
  const user = await requirePageUser("/account/chat");
  const orders = await db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30, select: { number: true, createdAt: true } });
  return <AccountShell active="chat"><ChatHome orders={orders.map((o) => ({ number: o.number, label: `سفارش ${orderNo(o.number)} — ${faDate(o.createdAt)}` }))} /></AccountShell>;
}
