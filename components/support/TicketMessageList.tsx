const roleLabel: Record<string, string> = { CUSTOMER: "شما", ADMIN: "پشتیبانی کیس‌لاین" };

export type TicketMessageItem = { id: string; senderRole: string; body: string; createdAt: string };

// viewerRole says which side "you" are on, purely to decide alignment/color
// — an admin viewing a ticket sees their own ADMIN messages on the right,
// while the customer sees their own CUSTOMER messages on the right; the
// actual sender label is always shown regardless, so there's no ambiguity.
export default function TicketMessageList({ messages, viewerRole }: { messages: TicketMessageItem[]; viewerRole: "CUSTOMER" | "ADMIN" }) {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => {
        const isMine = m.senderRole === viewerRole;
        return (
          <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[80%] rounded-2xl p-3 text-sm" style={isMine ? { background: "var(--ink)", color: "#fff" } : { background: "var(--surface-2)" }}>
              <p className="text-xs mb-1 opacity-70">{roleLabel[m.senderRole] || m.senderRole}</p>
              <p className="leading-7 whitespace-pre-wrap">{m.body}</p>
              <p className="text-[10px] mt-1 opacity-60">{new Date(m.createdAt).toLocaleString("fa-IR")}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
