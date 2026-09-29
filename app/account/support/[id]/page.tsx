import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import TicketMessageList from "@/components/support/TicketMessageList";
import CustomerReplyForm from "@/components/support/CustomerReplyForm";

const statusLabel: Record<string, string> = { OPEN: "در انتظار پاسخ پشتیبانی", ANSWERED: "پاسخ داده شد", CLOSED: "بسته‌شده" };

export default async function TicketDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const ticket = await db.supportTicket.findUnique({
    where: { id: params.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!ticket || ticket.userId !== session.user.id) notFound();

  return (
    <div className="max-w-lg mx-auto px-4 md:px-8 py-10">
      <p className="text-sm muted mb-1"><Link href="/account/support" className="hover:underline">پشتیبانی</Link> ← {ticket.subject}</p>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-extrabold">{ticket.subject}</h1>
        <span className="text-xs muted">{statusLabel[ticket.status]}</span>
      </div>

      <TicketMessageList
        viewerRole="CUSTOMER"
        messages={ticket.messages.map((m) => ({ id: m.id, senderRole: m.senderRole, body: m.body, createdAt: m.createdAt.toISOString() }))}
      />

      <CustomerReplyForm ticketId={ticket.id} />
    </div>
  );
}
