import { adminRoute, pageParams } from "@/lib/server/admin/core";
import { listRefunds } from "@/lib/server/finance/refunds";

export const GET = adminRoute(["refund.manage", "refund.approve"], (req) => {
  const { take, skip, page, sp } = pageParams(req, 30);
  return listRefunds(sp.get("status"), take, skip).then((r) => ({ ...r, page }));
});
