import { requireUser } from "@/lib/server/auth/guard";
import { parseJson, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { resubmitReview, reviewUpdateSchema } from "@/lib/server/reviews";

/** Edit and resubmit your own pending/rejected review (back to moderation). Ownership is enforced in the query itself. */
export const PATCH = route<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  const user = await requireUser();
  await rateLimit(`review-edit:${user.id}`, 20, 3600);
  return resubmitReview(user.id, (await ctx.params).id, await parseJson(req, reviewUpdateSchema));
});
