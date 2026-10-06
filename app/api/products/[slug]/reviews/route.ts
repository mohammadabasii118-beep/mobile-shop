import { db } from "@/lib/db";
import { notFound } from "@/lib/server/errors";
import { route } from "@/lib/server/http";
import { getProductReviewsPage } from "@/lib/server/reviews";

/** Public: a page of APPROVED reviews (load-more on the product page). */
export const GET = route<{ params: Promise<{ slug: string }> }>(async (req, ctx) => {
  const p = await db.product.findFirst({ where: { slug: decodeURIComponent((await ctx.params).slug), isActive: true }, select: { id: true } });
  if (!p) throw notFound();
  const page = Math.min(200, Math.max(1, Number(new URL(req.url).searchParams.get("page")) || 1));
  return getProductReviewsPage(p.id, page);
});
