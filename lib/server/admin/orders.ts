import { z } from "zod";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { OrderStatus, Prisma } from "@/lib/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/server/errors";
import { audit, pageParams, type AdminCtx } from "@/lib/server/admin/core";
import { ORDER_STATUS_LABEL, ORDER_TRANSITIONS } from "@/lib/server/orders";
import { approvePayment, cancelOrder, rejectPayment } from "@/lib/server/payments/service";
import { toLatinDigits } from "@/lib/server/validation";

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];

export async function listOrders(req: NextRequest) {
  const { take, skip, q, page, sp } = pageParams(req, 25);
  const where: Prisma.OrderWhereInput = {};
  const qn = toLatinDigits(q);
  if (q) where.OR = [...(/^\d{1,9}$/.test(qn) ? [{ number: Number(qn) }] : []), { customerName: { contains: q, mode: "insensitive" } }, { customerPhone: { contains: qn } }];
  const st = sp.get("status"), ps = sp.get("paymentStatus"), ty = sp.get("type");
  if (st && STATUSES.includes(st as OrderStatus)) where.status = st as OrderStatus;
  if (ps && ["PENDING", "REVIEW", "PAID", "REJECTED", "REFUNDED"].includes(ps)) where.paymentStatus = ps as never;
  if (ty === "RETAIL" || ty === "WHOLESALE") where.type = ty;
  const from = sp.get("from"), to = sp.get("to");
  if (from || to) where.createdAt = { ...(from && !Number.isNaN(Date.parse(from)) ? { gte: new Date(from) } : {}), ...(to && !Number.isNaN(Date.parse(to)) ? { lte: new Date(new Date(to).getTime() + 86400_000 - 1) } : {}) };
  const [items, total] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, take, skip, select: { id: true, number: true, type: true, status: true, paymentStatus: true, customerName: true, customerPhone: true, total: true, createdAt: true, _count: { select: { items: true } } } }),
    db.order.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / take)) };
}

export async function getOrder(number: number) {
  const o = await db.order.findUnique({
    where: { number },
    include: {
      items: true, history: { orderBy: { createdAt: "asc" } }, shippingMethod: { select: { id: true, name: true } },
      payments: { orderBy: { createdAt: "desc" }, include: { proofs: { orderBy: { createdAt: "asc" }, select: { id: true, originalName: true, mime: true, size: true, createdAt: true } } } },
      user: { select: { id: true, phone: true, displayName: true, isActive: true } },
    },
  });
  if (!o) throw notFound("سفارش پیدا نشد.");
  const ids = [...new Set(o.history.map((h) => h.createdById).filter((x): x is string => !!x))];
  const admins = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true, phone: true } });
  return { ...o, history: o.history.map((h) => ({ ...h, by: admins.find((u) => u.id === h.createdById)?.displayName ?? null })) };
}

const statusSchema = z.object({ status: z.enum(STATUSES as [OrderStatus, ...OrderStatus[]]), note: z.string().trim().max(300).optional() });
const NOTIFY: Partial<Record<OrderStatus, string>> = { SHIPPED: "سفارش شما تحویل شرکت حمل شد.", IN_TRANSIT: "سفارش شما در مسیر ارسال است.", DELIVERED: "سفارش شما تحویل داده شد.", PREPARING: "سفارش شما در حال آماده‌سازی است.", READY_TO_SHIP: "سفارش شما آماده ارسال است." };

/** Manual status change. Payment-driven, cancel and refund transitions have their own dedicated, stricter operations. */
export async function changeStatus(number: number, body: unknown, a: AdminCtx) {
  const { status, note } = statusSchema.parse(body);
  return db.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { number } });
    if (!o) throw notFound("سفارش پیدا نشد.");
    if (!ORDER_TRANSITIONS[o.status].includes(status)) throw conflict(`تغییر از «${ORDER_STATUS_LABEL[o.status]}» به «${ORDER_STATUS_LABEL[status]}» مجاز نیست.`, "invalid_transition");
    if (["PENDING_PAYMENT", "PAYMENT_REVIEW", "PAID"].includes(status)) throw conflict("این وضعیت فقط از مسیر بررسی پرداخت تغییر می‌کند.", "use_payment_review");
    if (status === "CANCELLED") throw conflict("برای لغو سفارش از گزینه «لغو سفارش» استفاده کنید.", "use_cancel");
    if (status === "REFUNDED") throw conflict("برای مرجوعی از گزینه «بازگشت وجه» استفاده کنید.", "use_refund");
    if (status === "PROCESSING" && o.paymentStatus !== "PAID") throw conflict("سفارش بدون پرداخت تأییدشده قابل پردازش نیست.", "unpaid");
    await tx.order.update({ where: { id: o.id }, data: { status } });
    await tx.orderStatusHistory.create({ data: { orderId: o.id, status, description: note ?? ORDER_STATUS_LABEL[status], createdById: a.admin.id } });
    if (o.userId && NOTIFY[status]) await tx.notification.create({ data: { userId: o.userId, type: "order_status", title: ORDER_STATUS_LABEL[status], body: NOTIFY[status], link: `/account/orders/${o.number}` } });
    await audit(a, "order.status", "order", o.id, { status: o.status }, { status, note: note ?? null, number: o.number }, tx);
    return { status };
  });
}

const shippingSchema = z.object({
  shippingMethodId: z.string().max(40).nullable().optional(),
  shippingCompany: z.string().trim().max(80).nullable().optional().transform((v) => v || null),
  trackingNumber: z.string().trim().max(60).nullable().optional().transform((v) => v || null),
});
/** Assigns method / carrier / tracking. The order's shipping *cost* stays as it was quoted at checkout. */
export async function updateShipping(number: number, body: unknown, a: AdminCtx) {
  const d = shippingSchema.parse(body);
  return db.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { number } });
    if (!o) throw notFound("سفارش پیدا نشد.");
    if (["CANCELLED", "REFUNDED"].includes(o.status)) throw conflict("سفارش بسته شده است.");
    if (d.shippingMethodId && !(await tx.shippingMethod.findUnique({ where: { id: d.shippingMethodId } }))) throw badRequest("روش ارسال نامعتبر است.");
    const patch: Prisma.OrderUpdateInput = {};
    if (d.shippingMethodId !== undefined) patch.shippingMethod = d.shippingMethodId ? { connect: { id: d.shippingMethodId } } : { disconnect: true };
    if (d.shippingCompany !== undefined) patch.shippingCompany = d.shippingCompany;
    if (d.trackingNumber !== undefined) patch.trackingNumber = d.trackingNumber;
    await tx.order.update({ where: { id: o.id }, data: patch });
    await audit(a, "order.shipping", "order", o.id, { shippingMethodId: o.shippingMethodId, shippingCompany: o.shippingCompany, trackingNumber: o.trackingNumber }, d, tx);
    return { ok: true };
  });
}

const reasonSchema = z.object({ reason: z.string().trim().min(3, "دلیل را بنویسید.").max(300) });
export async function adminCancel(number: number, body: unknown, a: AdminCtx) {
  const { reason } = reasonSchema.parse(body);
  const o = await db.order.findUnique({ where: { number }, select: { id: true, status: true, paymentStatus: true } });
  if (!o) throw notFound("سفارش پیدا نشد.");
  if (o.paymentStatus === "PAID") throw conflict("سفارش پرداخت‌شده را از مسیر «بازگشت وجه» ببندید.", "use_refund");
  return cancelOrder(o.id, a.admin.id, reason, (tx) => audit(a, "order.cancel", "order", o.id, { status: o.status }, { status: "CANCELLED", reason, number }, tx));
}

const refundSchema = reasonSchema.extend({ restock: z.boolean().default(true) });
/** Starts a refund: order + payment become REFUNDED (stock optionally returned). The money is returned manually until wallet refunds exist. */
export async function adminRefund(number: number, body: unknown, a: AdminCtx) {
  const { reason, restock } = refundSchema.parse(body);
  return db.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { number }, include: { items: true } });
    if (!o) throw notFound("سفارش پیدا نشد.");
    if (!ORDER_TRANSITIONS[o.status].includes("REFUNDED")) throw conflict("این سفارش قابل بازگشت وجه نیست.", "invalid_transition");
    if (o.paymentStatus !== "PAID") throw conflict("فقط سفارش پرداخت‌شده قابل بازگشت وجه است.", "unpaid");
    if (restock) for (const it of o.items) {
      if (!it.variantId) continue;
      const inv = await tx.inventory.update({ where: { variantId: it.variantId }, data: { quantity: { increment: it.quantity } } });
      await tx.inventoryMovement.create({ data: { inventoryId: inv.id, delta: it.quantity, balanceAfter: inv.quantity, reason: "refund", orderId: o.id, note: reason, createdById: a.admin.id } });
    }
    await tx.payment.updateMany({ where: { orderId: o.id, status: "PAID" }, data: { status: "REFUNDED" } });
    await tx.order.update({ where: { id: o.id }, data: { status: "REFUNDED", paymentStatus: "REFUNDED" } });
    await tx.orderStatusHistory.create({ data: { orderId: o.id, status: "REFUNDED", description: `بازگشت وجه: ${reason}`, createdById: a.admin.id } });
    if (o.userId) await tx.notification.create({ data: { userId: o.userId, type: "order_refund", title: "بازگشت وجه سفارش", body: reason, link: `/account/orders/${o.number}` } });
    await audit(a, "order.refund", "order", o.id, { status: o.status, paymentStatus: o.paymentStatus }, { status: "REFUNDED", reason, restock, number }, tx);
    return { status: "REFUNDED" };
  });
}

/* ───────── payment review ───────── */
export async function listPayments(req: NextRequest) {
  const { take, skip, q, page, sp } = pageParams(req, 25);
  const status = sp.get("status") ?? "REVIEW";
  const where: Prisma.PaymentWhereInput = {};
  if (["PENDING", "REVIEW", "PAID", "REJECTED", "REFUNDED"].includes(status)) where.status = status as never;
  // A cancelled order must not linger in the review queue.
  if (status === "REVIEW") where.order = { status: "PAYMENT_REVIEW" };
  const qn = toLatinDigits(q);
  if (q) where.order = { ...(where.order as object), OR: [...(/^\d{1,9}$/.test(qn) ? [{ number: Number(qn) }] : []), { customerName: { contains: q, mode: "insensitive" } }, { customerPhone: { contains: qn } }] };
  const [items, total] = await Promise.all([
    db.payment.findMany({ where, orderBy: [{ submittedAt: "asc" }, { createdAt: "desc" }], take, skip, include: { order: { select: { number: true, customerName: true, customerPhone: true, status: true } }, proofs: { orderBy: { createdAt: "asc" }, select: { id: true, originalName: true, mime: true, size: true } } } }),
    db.payment.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / take)) };
}

export const approve = (paymentId: string, a: AdminCtx) =>
  approvePayment(paymentId, a.admin.id, (tx, o) => audit(a, "payment.approve", "payment", paymentId, { status: "REVIEW" }, { status: "PAID", orderNumber: o.orderNumber }, tx));
export const reject = (paymentId: string, reason: string, a: AdminCtx) =>
  rejectPayment(paymentId, a.admin.id, reason, (tx, o) => audit(a, "payment.reject", "payment", paymentId, { status: "REVIEW" }, { status: "REJECTED", reason, orderNumber: o.orderNumber }, tx));
