import { adminRoute } from "@/lib/server/admin/core";
import { adminReopenChat } from "@/lib/server/chat";

export const POST = adminRoute<{ id: string }>("chat.reply", (_r, p, a) => adminReopenChat(a, p.id));
