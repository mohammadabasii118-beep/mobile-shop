import { z } from "zod";
import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/server/errors";

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Client input. Status, verifiedPurchase and orderItemId are never accepted from the client — they are derived here. */
const text = (max: number) => z.string().trim().max(max);
export const reviewFields = {
  rating: z.coerce.number().int().min(1, "امتیاز را از ۱ تا ۵ انتخاب کنید.").max(5, "امتیاز را از ۱ تا ۵ انتخاب کنید."),
  title: text(80).optional().transform((v) => v || null),
  body: z.string().trim().min(5, "نظر را کمی کامل‌تر بنویسید.").max(1500),
};
export const reviewCreateSchema = z.object({ orderNumber: z.coerce.number().int().positive(), productId: z.string().min(1).max(40), ...reviewFields }).strict();
export const reviewUpdateSchema = z.object(reviewFields).strict();

export const reviewerName = (u: { displayName: string | null; firstName: string | null }) => u.displayName?.trim() || u.firstName?.trim() || "کاربر";

/**
 * Creates a review for a product bought in one of the user's DELIVERED orders. verifiedPurchase / orderItemId come from the
 * User → Order → OrderItem chain (variant-aware: any variant of the product counts), never from the request.
 */
export async function createReview(userId: string, d: z.infer<typeof reviewCreateSchema>) {
  const order = await db.order.findFirst({
    where: { number: d.orderNumber, userId, status: "DELIVERED", items: { some: { productId: d.productId } } },
    select: { id: true, items: { where: { productId: d.productId }, orderBy: { id: "asc" }, take: 1, select: { id: true } } },
  });
  if (!order) throw notFound("این سفارش تحویل‌شده نیست یا این محصول در آن وجود ندارد.");
  const dup = await db.review.findFirst({ where: { userId, productId: d.productId, orderId: order.id }, select: { id: true, status: true } });
  if (dup) throw conflict("برای این محصول قبلاً نظر ثبت کرده‌اید.", "review_exists", { id: dup.id, status: dup.status });
  try {
    const r = await db.review.create({ data: { productId: d.productId, userId, orderId: order.id, orderItemId: order.items[0]!.id, verifiedPurchase: true, rating: d.rating, title: d.title, body: d.body, status: "pending" }, select: { id: true, status: true } });
    return r;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw conflict("برای این محصول قبلاً نظر ثبت کرده‌اید.", "review_exists"); // double-submit race hits the unique index
    throw e;
  }
}

/** The owner edits a pending or rejected review; it goes back to moderation (pending) — the same row, so no duplicate. */
export async function resubmitReview(userId: string, id: string, d: z.infer<typeof reviewUpdateSchema>) {
  const cur = await db.review.findFirst({ where: { id, userId }, select: { id: true, status: true, productId: true } });
  if (!cur) throw notFound("نظر پیدا نشد.");
  if (cur.status === "approved") throw conflict("نظر منتشرشده قابل ویرایش نیست.", "review_locked");
  const res = await db.review.updateMany({ where: { id, userId, status: { in: ["pending", "rejected"] } }, data: { rating: d.rating, title: d.title, body: d.body, status: "pending", rejectionReason: null, moderatedAt: null } });
  if (!res.count) throw conflict("نظر منتشرشده قابل ویرایش نیست.", "review_locked");
  return { id, status: "pending" as const };
}

export async function getReviewSummary(productId: string) {
  const rows = await db.review.groupBy({ by: ["rating"], where: { productId, status: "approved" }, _count: { _all: true } });
  const dist = [0, 0, 0, 0, 0];
  let count = 0, sum = 0;
  for (const r of rows) if (r.rating >= 1 && r.rating <= 5) { dist[r.rating - 1] = r._count._all; count += r._count._all; sum += r.rating * r._count._all; }
  return { count, avg: count ? Math.round((sum / count) * 10) / 10 : 0, dist };
}

export interface PublicReview { id: string; name: string; rating: number; title: string | null; body: string; verified: boolean; createdAt: string; reply: string | null }
export const REVIEWS_PAGE = 10;

/** One page of APPROVED reviews (newest first) in a single joined query; fetches one extra row to know if more exist. */
export async function getProductReviewsPage(productId: string, page = 1, size = REVIEWS_PAGE): Promise<{ items: PublicReview[]; hasMore: boolean }> {
  const rows = await db.review.findMany({
    relationLoadStrategy: "join",
    where: { productId, status: "approved" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (Math.max(1, page) - 1) * size, take: size + 1,
    select: { id: true, rating: true, title: true, body: true, verifiedPurchase: true, createdAt: true, adminReply: true, user: { select: { displayName: true, firstName: true } } },
  });
  return { hasMore: rows.length > size, items: rows.slice(0, size).map((r) => ({ id: r.id, name: reviewerName(r.user), rating: r.rating, title: r.title, body: r.body, verified: r.verifiedPurchase, createdAt: r.createdAt.toISOString(), reply: r.adminReply })) };
}

/** Homepage card: only what is shown, with the text cut on the server (the full review lives on the product page). */
export interface HomeReview { id: string; name: string; rating: number; body: string; verified: boolean; product: { name: string; slug: string; img: string | null } }
export const HOME_REVIEW_CHARS = 160;
const excerpt = (t: string) => { const s = t.replace(/\s+/g, " ").trim(); return s.length > HOME_REVIEW_CHARS ? s.slice(0, HOME_REVIEW_CHARS).replace(/\s\S*$/, "") + "…" : s; };

/** Homepage strip: one bounded query (LIMIT ≤ 6), only approved reviews of active products. */
export async function queryHomeReviews(limit = 6): Promise<HomeReview[]> {
  const rows = await db.review.findMany({
    relationLoadStrategy: "join",
    where: { status: "approved", product: { isActive: true } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: Math.min(6, Math.max(1, limit)),
    select: {
      id: true, rating: true, body: true, verifiedPurchase: true,
      user: { select: { displayName: true, firstName: true } },
      product: { select: { name: true, slug: true, images: { where: { type: "IMAGE" }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } } } },
    },
  });
  return rows.map((r) => ({ id: r.id, name: reviewerName(r.user), rating: r.rating, body: excerpt(r.body), verified: r.verifiedPurchase, product: { name: r.product.name, slug: r.product.slug, img: r.product.images[0]?.url ?? null } }));
}
