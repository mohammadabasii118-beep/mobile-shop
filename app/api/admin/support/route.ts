import { adminRoute, pageParams } from "@/lib/server/admin/core";
import { adminListTickets } from "@/lib/server/support";

export const GET = adminRoute(["support.read", "support.reply"], async (req) => {
  const { take, skip, q, sp, page } = pageParams(req, 25);
  return { ...(await adminListTickets({ status: sp.get("status"), priority: sp.get("priority"), assignee: sp.get("assignee"), search: q, take, skip })), page };
});
