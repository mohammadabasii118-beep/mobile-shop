import { z } from "zod";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { notFound } from "@/lib/server/errors";
import { notify } from "@/lib/server/notify";
import { audit, pageParams, type AdminCtx } from "@/lib/server/admin/core";

/* ───────── dashboard ───────── */
export async function dashboardData() {
  const now = new Date();
  const startDay = new Date(now); startDay.setHours(0, 0, 0, 0);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const since14 = new Date(startDay.getTime() - 13 * 86400_000);
  const since30 = new Date(now.getTime() - 30 * 86400_000);
  // Revenue = order totals of paid, not cancelled/refunded orders (wallet-paid and card-paid parts both count).
  const live = { paymentStatus: "PAID" as const, status: { notIn: ["CANCELLED", "REFUNDED"] as ("CANCELLED" | "REFUNDED")[] } };
  const paidSince = (d: Date) => ({ ...live, payments: { some: { status: "PAID" as const, paidAt: { gte: d } } } });
  const [totalOrders, pendingOrders, reviewOrders, paidOrders, rev, revToday, revMonth, lowStock, pendingWholesale, pendingReviews, newCustomers, recentOrders, recentPayments, lowList, series] = await Promise.all([
    db.order.count(),
    db.order.count({ where: { status: "PENDING_PAYMENT" } }),
    db.order.count({ where: { status: "PAYMENT_REVIEW" } }),
    db.order.count({ where: { paymentStatus: "PAID", status: { notIn: ["CANCELLED", "REFUNDED"] } } }),
    db.order.aggregate({ where: live, _sum: { total: true } }),
    db.order.aggregate({ where: paidSince(startDay), _sum: { total: true } }),
    db.order.aggregate({ where: paidSince(startMonth), _sum: { total: true } }),
    db.$queryRaw<{ c: bigint }[]>`SELECT count(*) AS c FROM "Inventory" WHERE "quantity" <= "lowStockThreshold"`,
    db.wholesaleApplication.count({ where: { status: "PENDING" } }),
    db.review.count({ where: { status: "pending" } }),
    db.user.count({ where: { createdAt: { gte: since30 }, roles: { none: { role: { isStaff: true } } } } }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { number: true, customerName: true, total: true, status: true, createdAt: true } }),
    db.payment.findMany({ where: { status: { in: ["REVIEW", "PAID"] } }, orderBy: { updatedAt: "desc" }, take: 6, select: { id: true, amount: true, status: true, updatedAt: true, order: { select: { number: true, customerName: true } } } }),
    db.$queryRaw<{ sku: string; name: string; quantity: number; threshold: number; variantId: string }[]>`SELECT v."id" AS "variantId", v."sku", p."name", i."quantity", i."lowStockThreshold" AS threshold FROM "Inventory" i JOIN "ProductVariant" v ON v."id" = i."variantId" JOIN "Product" p ON p."id" = v."productId" WHERE i."quantity" <= i."lowStockThreshold" ORDER BY i."quantity" ASC LIMIT 6`,
    db.$queryRaw<{ d: Date; s: bigint }[]>`SELECT date_trunc('day', "paidAt") AS d, sum(o."total") AS s FROM "Payment" p JOIN "Order" o ON o."id" = p."orderId" WHERE p."status" = 'PAID' AND o."status" NOT IN ('CANCELLED','REFUNDED') AND p."paidAt" >= ${since14} GROUP BY 1`,
  ]);
  const byDay = new Map(series.map((r) => [new Date(r.d).toDateString(), Number(r.s)]));
  const chart = Array.from({ length: 14 }, (_, i) => { const d = new Date(since14.getTime() + i * 86400_000); return { date: d.toISOString().slice(0, 10), value: byDay.get(d.toDateString()) ?? 0 }; });
  const soon = new Date(now.getTime() + 7 * 86400_000);
  const [productCount, variantCount, outOfStock, activeDiscounts, expiring, priceChanges] = await Promise.all([
    db.product.count(),
    db.productVariant.count(),
    db.inventory.count({ where: { quantity: 0 } }),
    db.discount.count({ where: { isActive: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] } }),
    db.discount.findMany({ where: { isActive: true, endsAt: { gte: now, lte: soon } }, orderBy: { endsAt: "asc" }, take: 5, select: { id: true, name: true, endsAt: true } }),
    // Costs are deliberately not part of the dashboard: only prices.
    db.priceHistory.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, oldPrice: true, newPrice: true, source: true, createdAt: true, product: { select: { name: true } }, variant: { select: { sku: true } } } }),
  ]);
  return {
    catalog: { productCount, variantCount, outOfStock, activeDiscounts, expiring, priceChanges },
    totalOrders, pendingOrders, reviewOrders, paidOrders, revenue: rev._sum.total ?? 0, revenueToday: revToday._sum.total ?? 0, revenueMonth: revMonth._sum.total ?? 0,
    lowStock: Number(lowStock[0]?.c ?? 0), pendingWholesale, pendingReviews, reviews: await reviewStats(), newCustomers, recentOrders, recentPayments, lowList, chart,
  };
}

/* ───────── reviews moderation ───────── */
export async function reviewStats() {
  const [rows, avg] = await Promise.all([db.review.groupBy({ by: ["status"], _count: { _all: true } }), db.review.aggregate({ where: { status: "approved" }, _avg: { rating: true } })]);
  const n = (st: string) => rows.find((r) => r.status === st)?._count._all ?? 0;
  return { pending: n("pending"), approved: n("approved"), rejected: n("rejected"), avgRating: Math.round((avg._avg.rating ?? 0) * 10) / 10 };
}
export async function listReviews(req: NextRequest) {
  const { take, skip, q, page, sp } = pageParams(req, 25);
  const where: Prisma.ReviewWhereInput = {};
  const st = sp.get("status") ?? "pending";
  if (["pending", "approved", "rejected"].includes(st)) where.status = st;
  const rating = Number(sp.get("rating"));
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) where.rating = rating;
  if (q) where.OR = [{ body: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }, { product: { name: { contains: q, mode: "insensitive" } } }, { user: { OR: [{ displayName: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } }];
  if (sp.get("productId")) where.productId = sp.get("productId")!;
  const [items, total, stats] = await Promise.all([
    db.review.findMany({ relationLoadStrategy: "join", where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, skip, include: { product: { select: { id: true, name: true, slug: true } }, user: { select: { id: true, displayName: true, phone: true } }, order: { select: { number: true, status: true } } } }),
    db.review.count({ where }),
    reviewStats(),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / take)), stats };
}
export async function moderateReview(id: string, body: unknown, a: AdminCtx) {
  const { status, reason } = z.object({ status: z.enum(["approved", "rejected", "pending"]), reason: z.string().trim().max(300).optional() }).parse(body);
  return db.$transaction(async (tx) => {
    const r = await tx.review.findUnique({ where: { id } });
    if (!r) throw notFound("نظر پیدا نشد.");
    await tx.review.update({ where: { id }, data: { status, moderatedAt: status === "pending" ? null : new Date(), rejectionReason: status === "rejected" ? reason || null : null } });
    if (status !== r.status && status !== "pending") {
      const prod = await tx.product.findUnique({ where: { id: r.productId }, select: { name: true, slug: true } });
      await notify(tx, r.userId, "review_moderated", status === "approved"
        ? { title: "نظر شما منتشر شد", body: prod?.name, link: `/product/${prod?.slug}` }
        : { title: "نظر شما رد شد", body: reason || "می‌توانید آن را ویرایش و دوباره ارسال کنید.", link: "/account/reviews" });
    }
    const agg = await tx.review.aggregate({ where: { productId: r.productId, status: "approved" }, _avg: { rating: true }, _count: true });
    await tx.product.update({ where: { id: r.productId }, data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count } });
    await audit(a, "review.moderate", "review", id, { status: r.status }, { status }, tx);
    return { status };
  });
}
export async function deleteReview(id: string, a: AdminCtx) {
  return db.$transaction(async (tx) => {
    const r = await tx.review.findUnique({ where: { id } });
    if (!r) throw notFound("نظر پیدا نشد.");
    await tx.review.delete({ where: { id } });
    const agg = await tx.review.aggregate({ where: { productId: r.productId, status: "approved" }, _avg: { rating: true }, _count: true });
    await tx.product.update({ where: { id: r.productId }, data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count } });
    await audit(a, "review.delete", "review", id, { status: r.status, body: r.body.slice(0, 200) }, undefined, tx);
    return { deleted: true };
  });
}

/* ───────── audit log (read-only; there is deliberately no write API) ───────── */
export async function listAudit(req: NextRequest) {
  const { take, skip, q, page, sp } = pageParams(req, 40);
  const where: Prisma.AdminLogWhereInput = {};
  if (q) where.OR = [{ action: { contains: q, mode: "insensitive" } }, { entityId: { contains: q } }];
  if (sp.get("entity")) where.entity = sp.get("entity")!;
  if (sp.get("adminId")) where.adminId = sp.get("adminId")!;
  const [items, total] = await Promise.all([
    db.adminLog.findMany({ where, orderBy: { createdAt: "desc" }, take, skip, include: { admin: { select: { displayName: true, phone: true } } } }),
    db.adminLog.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / take)) };
}

/* ───────── read-only wallet / loyalty / support views (full flows arrive in later phases) ───────── */
