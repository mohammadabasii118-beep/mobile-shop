import { adminRoute } from "@/lib/server/admin/core";
import { adminGetChat } from "@/lib/server/chat";

export const GET = adminRoute<{ id: string }>(["chat.read", "chat.reply"], (req, p, a) => adminGetChat(a, p.id, new URL(req.url).searchParams.get("after")));
