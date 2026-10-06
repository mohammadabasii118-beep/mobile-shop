import { parseJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { createOrder } from "@/lib/server/checkout";
import { createOrderSchema } from "@/lib/server/validation";

// Body: address, shipping method, coupon code, payment method, note. No prices or totals are read from it.
export const POST = route(async (req) => {
  const user = await requireUser();
  return createOrder(user, await parseJson(req, createOrderSchema));
});
