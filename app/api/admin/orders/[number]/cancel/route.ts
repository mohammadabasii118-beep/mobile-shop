import { adminRoute } from "@/lib/server/admin/core";
import { adminCancel } from "@/lib/server/admin/orders";
import { badRequest } from "@/lib/server/errors";

export const POST = adminRoute<{ number: string }>("order.write", async (req, p, a) => {
  if (!/^\d{1,9}$/.test(p.number)) throw badRequest("شماره سفارش نامعتبر است.");
  return adminCancel(Number(p.number), await req.json().catch(() => ({})), a);
});
