import { parseJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { applyCoupon, removeCoupon } from "@/lib/server/cart";
import { rateLimit } from "@/lib/server/rate-limit";
import { couponSchema } from "@/lib/server/validation";

export const POST = route(async (req) => {
  const user = await requireUser();
  await rateLimit(`coupon:${user.id}`, 20, 600);
  const { code } = await parseJson(req, couponSchema);
  return applyCoupon(user, code);
});
export const DELETE = route(async () => removeCoupon(await requireUser()));
