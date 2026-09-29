import { adminRoute } from "@/lib/server/admin/core";
import { completeBankRefund } from "@/lib/server/finance/refunds";

export const POST = adminRoute<{ id: string }>("refund.approve", async (req, p, a) => completeBankRefund(p.id, await req.json().catch(() => ({})), a));
