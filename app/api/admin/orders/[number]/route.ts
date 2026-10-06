import { adminRoute } from "@/lib/server/admin/core";
import { getOrder } from "@/lib/server/admin/orders";
import { badRequest } from "@/lib/server/errors";

export const GET = adminRoute<{ number: string }>("order.read", (_r, p) => {
  if (!/^\d{1,9}$/.test(p.number)) throw badRequest("شماره سفارش نامعتبر است.");
  return getOrder(Number(p.number));
});
