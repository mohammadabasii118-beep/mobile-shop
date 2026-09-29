import { parseJson, route } from "@/lib/server/http";
import { getCurrentUser } from "@/lib/server/auth/session";
import { addToCart } from "@/lib/server/cart";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/http";
import { cartAddSchema } from "@/lib/server/validation";

// The body carries identifiers and a quantity only. Price is never accepted from the client.
export const POST = route(async (req) => {
  await rateLimit(`cart:add:${clientIp(req)}`, 120, 600);
  const body = await parseJson(req, cartAddSchema);
  return addToCart(await getCurrentUser(), body);
});
