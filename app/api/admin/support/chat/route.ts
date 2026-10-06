import { adminRoute, pageParams } from "@/lib/server/admin/core";
import { adminListChats } from "@/lib/server/chat";

export const GET = adminRoute(["chat.read", "chat.reply"], async (req, _p, a) => {
  const { take, skip, q, sp, page } = pageParams(req, 30);
  return { ...(await adminListChats(a, { tab: sp.get("tab"), search: q, take, skip })), page };
});
