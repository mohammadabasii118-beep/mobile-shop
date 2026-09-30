import { requireUser } from "@/lib/server/auth/guard";
import { parseJson, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { createReview, reviewCreateSchema } from "@/lib/server/reviews";

/** Only a customer whose order was DELIVERED can review a product from it (once per product per order). Reviews are moderated before they appear. */
export const POST = route(async (req) => {
  const user = await requireUser();
  await rateLimit(`review:${user.id}`, 10, 3600);
  return createReview(user.id, await parseJson(req, reviewCreateSchema));
});
