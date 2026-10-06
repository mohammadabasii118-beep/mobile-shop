import { adminRoute, pageParams } from "@/lib/server/admin/core";
import { adminListTickets } from "@/lib/server/support";

export const GET = adminRoute(["support.read", "support.reply"], async (req) => {
  const { take, skip, q, sp, page } = pageParams(req, 25);
  return { ...(await adminListTickets({ status: sp.get("status"), priority: sp.get("priority"), assignee: sp.get("assignee"), category: sp.get("category"), order: sp.get("order"), userId: sp.get("userId"), from: sp.get("from"), to: sp.get("to"), search: q, take, skip })), page };
});
