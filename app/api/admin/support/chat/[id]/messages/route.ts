import { adminRoute } from "@/lib/server/admin/core";
import { adminSendChat, readChatBody } from "@/lib/server/chat";

export const POST = adminRoute<{ id: string }>("chat.reply", async (req, p, a) => {
  const { fields, files } = await readChatBody(req);
  return adminSendChat(a, p.id, fields, files);
});
