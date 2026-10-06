import { route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { listMyChats, readChatBody, startChat } from "@/lib/server/chat";

export const GET = route(async () => listMyChats(await requireUser()));
export const POST = route(async (req) => {
  const user = await requireUser();
  const { fields, files } = await readChatBody(req);
  return startChat(user, fields, files);
});
