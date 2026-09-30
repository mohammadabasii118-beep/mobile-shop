import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { readChatBody, sendMyMessage } from "@/lib/server/chat";

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requireUser();
  const { fields, files } = await readChatBody(req);
  return sendMyMessage(user, (await params).id, fields, files);
});
