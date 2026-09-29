import { adminRoute } from "@/lib/server/admin/core";
import { cancelRefund } from "@/lib/server/finance/refunds";

export const POST = adminRoute<{ id: string }>(["refund.manage", "refund.approve"], async (req, p, a) => cancelRefund(p.id, await req.json().catch(() => ({})), a));
