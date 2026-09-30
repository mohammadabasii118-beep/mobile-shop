import { adminRoute } from "@/lib/server/admin/core";
import { adminTicketFromChat } from "@/lib/server/chat";

export const POST = adminRoute<{ id: string }>(["chat.reply"], async (req, p, a) => adminTicketFromChat(a, p.id, await req.json().catch(() => ({}))));
