import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import TicketMessageList from "@/components/support/TicketMessageList";
import AdminTicketActions from "@/components/admin/AdminTicketActions";

const statusLabel: Record<string, string> = { OPEN: "در انتظار پاسخ", ANSWERED: "پاسخ داده‌شده", CLOSED: "بسته‌شده" };

export default async function AdminTicketDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ticket = await db.supportTicket.findUnique({
    where: { id: params.id },
    include: { messages: { orderBy: { createdAt: "asc" } }, user: { select: { name: true, email: true, phone: true } } },
  });
  if (!ticket) notFound();

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-extrabold">{ticket.subject}</h1>
        <span className="text-xs muted">{statusLabel[ticket.status]}</span>
      </div>
      <p className="text-sm muted mb-6">{ticket.user.name} — {ticket.user.email}{ticket.user.phone ? ` · ${ticket.user.phone}` : ""}</p>

      <TicketMessageList
        viewerRole="ADMIN"
        messages={ticket.messages.map((m) => ({ id: m.id, senderRole: m.senderRole, body: m.body, createdAt: m.createdAt.toISOString() }))}
      />

      <AdminTicketActions ticketId={ticket.id} status={ticket.status} />
    </div>
  );
}
