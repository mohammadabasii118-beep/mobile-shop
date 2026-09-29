import { z } from "zod";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { notFound } from "@/lib/server/errors";
import { audit, pageParams, type AdminCtx } from "@/lib/server/admin/core";

/* ───────── dashboard ───────── */
export async function dashboardData() {
  const now = new Date();
  const startDay = new Date(now); startDay.setHours(0, 0, 0, 0);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const since14 = new Date(startDay.getTime() - 13 * 86400_000);
  const since30 = new Date(now.getTime() - 30 * 86400_000);
  const paid = { status: "PAID" as const, order: { status: { notIn: ["CANCELLED", "REFUNDED"] as ("CANCELLED" | "REFUNDED")[] } } };
  const [totalOrders, pendingOrders, reviewOrders, paidOrders, rev, revToday, revMonth, lowStock, pendingWholesale, pendingReviews, newCustomers, recentOrders, recentPayments, lowList, series] = await Promise.all([
    db.order.count(),
    db.order.count({ where: { status: "PENDING_PAYMENT" } }),
    db.order.count({ where: { status: "PAYMENT_REVIEW" } }),
    db.order.count({ where: { paymentStatus: "PAID", status: { notIn: ["CANCELLED", "REFUNDED"] } } }),
    db.payment.aggregate({ where: paid, _sum: { amount: true } }),
    db.payment.aggregate({ where: { ...paid, paidAt: { gte: startDay } }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { ...paid, paidAt: { gte: startMonth } }, _sum: { amount: true } }),
    db.$queryRaw<{ c: bigint }[]>`SELECT count(*) AS c FROM "Inventory" WHERE "quantity" <= "lowStockThreshold"`,
    db.wholesaleApplication.count({ where: { status: "PENDING" } }),
    db.review.count({ where: { status: "pending" } }),
    db.user.count({ where: { createdAt: { gte: since30 }, roles: { none: { role: { isStaff: true } } } } }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { number: true, customerName: true, total: true, status: true, createdAt: true } }),
    db.payment.findMany({ where: { status: { in: ["REVIEW", "PAID"] } }, orderBy: { updatedAt: "desc" }, take: 6, select: { id: true, amount: true, status: true, updatedAt: true, order: { select: { number: true, customerName: true } } } }),
    db.$queryRaw<{ sku: string; name: string; quantity: number; threshold: number; variantId: string }[]>`SELECT v."id" AS "variantId", v."sku", p."name", i."quantity", i."lowStockThreshold" AS threshold FROM "Inventory" i JOIN "ProductVariant" v ON v."id" = i."variantId" JOIN "Product" p ON p."id" = v."productId" WHERE i."quantity" <= i."lowStockThreshold" ORDER BY i."quantity" ASC LIMIT 6`,
    db.$queryRaw<{ d: Date; s: bigint }[]>`SELECT date_trunc('day', "paidAt") AS d, sum("amount") AS s FROM "Payment" p JOIN "Order" o ON o."id" = p."orderId" WHERE p."status" = 'PAID' AND o."status" NOT IN ('CANCELLED','REFUNDED') AND p."paidAt" >= ${since14} GROUP BY 1`,
  ]);
  const byDay = new Map(series.map((r) => [new Date(r.d).toDateString(), Number(r.s)]));
  const chart = Array.from({ length: 14 }, (_, i) => { const d = new Date(since14.getTime() + i * 86400_000); return { date: d.toISOString().slice(0, 10), value: byDay.get(d.toDateString()) ?? 0 }; });
  return {
    totalOrders, pendingOrders, reviewOrders, paidOrders, revenue: rev._sum.amount ?? 0, revenueToday: revToday._sum.amount ?? 0, revenueMonth: revMonth._sum.amount ?? 0,
    lowStock: Number(lowStock[0]?.c ?? 0), pendingWholesale, pendingReviews, newCustomers, recentOrders, recentPayments, lowList, chart,
  };
}

/* ───────── reviews moderation ───────── */
export async function listReviews(req: NextRequest) {
  const { take, skip, q, page, sp } = pageParams(req, 25);
  const where: Prisma.ReviewWhereInput = {};
  const st = sp.get("status") ?? "pending";
  if (["pending", "approved", "rejected"].includes(st)) where.status = st;
  if (q) where.OR = [{ body: { contains: q, mode: "insensitive" } }, { product: { name: { contains: q, mode: "insensitive" } } }];
  const [items, total] = await Promise.all([
    db.review.findMany({ where, orderBy: { createdAt: "desc" }, take, skip, include: { product: { select: { name: true, slug: true } }, user: { select: { displayName: true, phone: true } } } }),
    db.review.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / take)) };
}
export async function moderateReview(id: string, body: unknown, a: AdminCtx) {
  const { status } = z.object({ status: z.enum(["approved", "rejected", "pending"]) }).parse(body);
  return db.$transaction(async (tx) => {
    const r = await tx.review.findUnique({ where: { id } });
    if (!r) throw notFound("نظر پیدا نشد.");
    await tx.review.update({ where: { id }, data: { status } });
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
export async function listWallets(req: NextRequest) {
  const { take, skip, page } = pageParams(req, 30);
  const [items, total] = await Promise.all([
    db.wallet.findMany({ orderBy: { balance: "desc" }, take, skip, include: { user: { select: { id: true, displayName: true, phone: true } }, transactions: { orderBy: { createdAt: "desc" }, take: 3 } } }),
    db.wallet.count(),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / take)) };
}
export async function listLoyalty(req: NextRequest) {
  const { take, skip, page } = pageParams(req, 30);
  const [items, total] = await Promise.all([
    db.loyaltyAccount.findMany({ orderBy: { points: "desc" }, take, skip, include: { user: { select: { id: true, displayName: true, phone: true } }, transactions: { orderBy: { createdAt: "desc" }, take: 3 } } }),
    db.loyaltyAccount.count(),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / take)) };
}
export async function listTickets(req: NextRequest) {
  const { take, skip, page } = pageParams(req, 30);
  const [items, total] = await Promise.all([
    db.supportTicket.findMany({ orderBy: { updatedAt: "desc" }, take, skip, include: { user: { select: { displayName: true, phone: true } }, _count: { select: { messages: true } } } }),
    db.supportTicket.count(),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / take)) };
}
