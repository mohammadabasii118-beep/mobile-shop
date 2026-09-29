import { adminRoute } from "@/lib/server/admin/core";
import { requestRefund } from "@/lib/server/finance/refunds";
import { badRequest } from "@/lib/server/errors";

export const POST = adminRoute<{ number: string }>("refund.manage", async (req, p, a) => {
  if (!/^\d{1,9}$/.test(p.number)) throw badRequest("شماره سفارش نامعتبر است.");
  return requestRefund(Number(p.number), await req.json().catch(() => ({})), a);
});
