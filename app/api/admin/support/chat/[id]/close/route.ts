import { adminRoute } from "@/lib/server/admin/core";
import { adminCloseChat } from "@/lib/server/chat";

export const POST = adminRoute<{ id: string }>("chat.reply", (_r, p, a) => adminCloseChat(a, p.id));
