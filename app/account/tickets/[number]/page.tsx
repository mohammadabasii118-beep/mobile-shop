import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Paperclip } from "lucide-react";
import { AccountShell } from "@/components/account-shell";
import { TicketReply } from "@/components/account/ticket-forms";
import { requirePageUser } from "@/lib/server/auth/guard";
import { getMyTicket } from "@/lib/server/support";
import { TICKET_STATUS, faDateTime, orderNo } from "@/lib/account-format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تیکت پشتیبانی | CaseLine", robots: { index: false } };

export default async function TicketPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const user = await requirePageUser(`/account/tickets/${number}`);
  const t = Number.isInteger(Number(number)) ? await getMyTicket(user, Number(number)).catch(() => null) : null;
  if (!t) notFound();
  return (
    <AccountShell active="tickets">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-base font-black">{t.subject}</h2><p className="mt-1 text-[11px] text-muted">تیکت #{orderNo(t.number)} · {faDateTime(t.createdAt)}{t.sourceChat ? <> · ارجاع از <Link href={`/account/chat/${t.sourceChat.id}`} className="font-bold text-primary">چت آنلاین {orderNo(t.sourceChat.number)}</Link></> : null}{t.orderNumber ? <> · سفارش <Link href={`/account/orders/${t.orderNumber}`} className="font-bold text-primary">#{orderNo(t.orderNumber)}</Link></> : null}</p></div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${TICKET_STATUS[t.status]?.[1]}`}>{TICKET_STATUS[t.status]?.[0]}</span>
        </div>
        <ol className="space-y-3">
          {t.messages.map((m) => (
            <li key={m.id} className={cn("rounded-2xl p-4 text-[13px] leading-7", m.isStaff ? "me-8 bg-primary/8 ring-1 ring-primary/20" : "ms-8 bg-surface-2")}>
              <div className="mb-1 flex items-center justify-between text-[11px] text-muted"><b className={m.isStaff ? "text-primary" : ""}>{m.isStaff ? "پشتیبانی کیس‌لاین" : "شما"}</b><span>{faDateTime(m.createdAt)}</span></div>
              <p className="whitespace-pre-wrap">{m.body}</p>
              {m.files.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{m.files.map((f) => <a key={f.id} href={`/api/support/attachments/${f.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1 text-[11px] font-bold text-primary"><Paperclip className="size-3.5" />{f.originalName}</a>)}</div>}
            </li>
          ))}
        </ol>
        <TicketReply number={t.number} closed={t.status === "closed"} />
      </div>
    </AccountShell>
  );
}
