import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { db } from "@/lib/db";
import { AccountShell } from "@/components/account-shell";
import { NewTicketForm } from "@/components/account/ticket-forms";
import { requirePageUser } from "@/lib/server/auth/guard";
import { listMyTickets } from "@/lib/server/support";
import { TICKET_STATUS, faDate, orderNo } from "@/lib/account-format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تیکت‌های پشتیبانی | CaseLine", robots: { index: false } };

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ order?: string; category?: string }> }) {
  const sp = await searchParams;
  const user = await requirePageUser("/account/tickets");
  const [tickets, orders] = await Promise.all([listMyTickets(user.id), db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30, select: { number: true, createdAt: true, total: true } })]);
  return (
    <AccountShell active="tickets">
      <div className="space-y-4">
        <NewTicketForm defaults={sp.order ? { order: sp.order, category: sp.category } : undefined} orders={orders.map((o) => ({ number: o.number, label: `سفارش ${orderNo(o.number)} — ${faDate(o.createdAt)}` }))} />
        {tickets.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-primary/30 px-4 py-9 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-[10px] bg-primary/10 text-primary"><MessagesSquare className="size-6" /></span>
            <p className="mt-3 text-xs text-muted">هنوز تیکتی نساخته‌اید. اگر سوال یا مشکلی دارید، از دکمه بالا تیکت بزنید.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/account/tickets/${t.number}`} className="block rounded-[16px] border border-border bg-surface p-4 transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-3"><b className="text-[14px]">{t.subject}</b><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${TICKET_STATUS[t.status]?.[1]}`}>{TICKET_STATUS[t.status]?.[0]}</span></div>
                  <p className="mt-1 text-[11px] text-muted">تیکت #{orderNo(t.number)} · {faDate(t.updatedAt)} · {t._count.messages.toLocaleString("fa-IR")} پیام</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AccountShell>
  );
}
