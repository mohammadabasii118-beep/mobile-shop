import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { badRequest, conflict, forbidden, notFound } from "@/lib/server/errors";
import { rateLimit } from "@/lib/server/rate-limit";
import { getStorage } from "@/lib/server/storage";
import { validateReceipt } from "@/lib/server/upload";
import { ORDER_TRANSITIONS } from "@/lib/server/orders";
import { hasPermission } from "@/lib/server/auth/guard";
import { notify } from "@/lib/server/notify";
import { releaseUnpaidOrder } from "@/lib/server/finance/lifecycle";
import { earnForOrder } from "@/lib/server/finance/loyalty";
import type { SessionUser } from "@/lib/server/auth/session";

const MAX_PROOFS_PER_PAYMENT = 5;

/** Customer submits a receipt + reference number. Payment → REVIEW, Order → PAYMENT_REVIEW. */
export async function submitReceipt(user: SessionUser, orderNumber: number, referenceNumber: string, file: { name: string; type: string; size: number; buffer: Buffer }) {
  await rateLimit(`upload:${user.id}`, 10, 3600);
  const order = await db.order.findFirst({ where: { number: orderNumber, userId: user.id }, include: { payments: { orderBy: { createdAt: "desc" }, take: 1, include: { _count: { select: { proofs: true } } } } } });
  if (!order) throw notFound("سفارش پیدا نشد.");
  const payment = order.payments[0];
  if (!payment) throw notFound("پرداختی برای این سفارش ثبت نشده است.");
  if (order.status !== "PENDING_PAYMENT" || !["PENDING", "REJECTED"].includes(payment.status)) throw conflict("برای این سفارش نمی‌توان رسید جدید ارسال کرد.", "payment_not_open");
  if (payment._count.proofs >= MAX_PROOFS_PER_PAYMENT) throw conflict("تعداد رسیدهای ارسالی از حد مجاز بیشتر است. با پشتیبانی تماس بگیرید.", "too_many_proofs");

  const v = validateReceipt(file, file.buffer);
  const storageKey = `receipts/${order.id}/${randomUUID()}.${v.ext}`;
  const storage = getStorage();
  await storage.put(storageKey, file.buffer);
  try {
    await db.$transaction(async (tx) => {
      await tx.paymentProof.create({ data: { paymentId: payment.id, storageKey, originalName: v.originalName, mime: v.mime, size: v.size } });
      await tx.payment.update({ where: { id: payment.id }, data: { status: "REVIEW", referenceNumber, submittedAt: new Date(), rejectReason: null } });
      await tx.order.update({ where: { id: order.id }, data: { status: "PAYMENT_REVIEW", paymentStatus: "REVIEW" } });
      await tx.orderStatusHistory.create({ data: { orderId: order.id, status: "PAYMENT_REVIEW", description: "رسید پرداخت ارسال شد و در انتظار بررسی است.", createdById: user.id } });
    });
  } catch (e) {
    await storage.delete(storageKey).catch(() => {});
    throw e;
  }
  return { status: "REVIEW" as const };
}

/** Streams a stored receipt. Allowed only for the order owner or staff with payment.review. */
export async function openProof(user: SessionUser, orderNumber: number, proofId: string) {
  const proof = await db.paymentProof.findUnique({ where: { id: proofId }, include: { payment: { include: { order: { select: { number: true, userId: true } } } } } });
  if (!proof || proof.payment.order.number !== orderNumber) throw notFound();
  const owner = proof.payment.order.userId === user.id;
  if (!owner && !hasPermission(user, "payment.review")) throw forbidden();
  const obj = await getStorage().get(proof.storageKey);
  return { ...obj, mime: proof.mime, name: proof.originalName };
}

async function pendingReview(tx: Prisma.TransactionClient, paymentId: string) {
  const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!payment) throw notFound("پرداخت پیدا نشد.");
  if (payment.status !== "REVIEW") throw conflict("این پرداخت در وضعیت بررسی نیست.", "payment_not_in_review");
  return payment;
}

/** Admin approval: Payment = PAID, Order = PROCESSING. Caller must already hold payment.review. */
export async function approvePayment(paymentId: string, adminId: string, after?: (tx: Prisma.TransactionClient, p: { orderId: string; orderNumber: number }) => Promise<void>) {
  return db.$transaction(async (tx) => {
    const payment = await pendingReview(tx, paymentId);
    if (!ORDER_TRANSITIONS[payment.order.status].includes("PROCESSING")) throw conflict("وضعیت سفارش اجازه تأیید پرداخت را نمی‌دهد.");
    const now = new Date();
    await tx.payment.update({ where: { id: paymentId }, data: { status: "PAID", paidAt: now, reviewedById: adminId, reviewedAt: now, rejectReason: null } });
    await tx.order.update({ where: { id: payment.orderId }, data: { status: "PROCESSING", paymentStatus: "PAID" } });
    await tx.orderStatusHistory.create({ data: { orderId: payment.orderId, status: "PROCESSING", description: "پرداخت تأیید شد. سفارش در حال پردازش است.", createdById: adminId } });
    if (payment.order.userId) await notify(tx, payment.order.userId, "payment_approved", { title: "پرداخت شما تأیید شد", body: `سفارش ${payment.order.number.toLocaleString("fa-IR")} در حال پردازش است.`, link: `/account/orders/${payment.order.number}`, data: { orderNumber: payment.order.number } });
    await earnForOrder(tx, payment.orderId, "payment");
    await after?.(tx, { orderId: payment.orderId, orderNumber: payment.order.number });
    return { ok: true };
  });
}

/** Admin rejection: Payment = REJECTED with a reason; the order goes back to awaiting payment so the customer can resubmit. */
export async function rejectPayment(paymentId: string, adminId: string, reason: string, after?: (tx: Prisma.TransactionClient, p: { orderId: string; orderNumber: number }) => Promise<void>) {
  if (!reason.trim()) throw badRequest("دلیل رد پرداخت لازم است.");
  return db.$transaction(async (tx) => {
    const payment = await pendingReview(tx, paymentId);
    await tx.payment.update({ where: { id: paymentId }, data: { status: "REJECTED", rejectReason: reason, reviewedById: adminId, reviewedAt: new Date() } });
    await tx.order.update({ where: { id: payment.orderId }, data: { status: "PENDING_PAYMENT", paymentStatus: "REJECTED" } });
    await tx.orderStatusHistory.create({ data: { orderId: payment.orderId, status: "PENDING_PAYMENT", description: `پرداخت رد شد: ${reason}`, createdById: adminId } });
    if (payment.order.userId) await notify(tx, payment.order.userId, "payment_rejected", { title: "پرداخت شما رد شد", body: reason, link: `/account/orders/${payment.order.number}`, data: { orderNumber: payment.order.number } });
    await after?.(tx, { orderId: payment.orderId, orderNumber: payment.order.number });
    return { ok: true };
  });
}

/**
 * Cancels an UNPAID order and undoes everything it consumed: stock, coupon use, loyalty points and any wallet
 * amount already deducted at checkout (each exactly once). A paid order is closed through the refund flow instead.
 */
export async function cancelOrder(orderId: string, byId: string, reason: string, after?: (tx: Prisma.TransactionClient) => Promise<void>) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw notFound("سفارش پیدا نشد.");
    if (order.paymentStatus === "PAID") throw conflict("سفارش پرداخت‌شده را باید از مسیر «بازگشت وجه» ببندید.", "use_refund");
    if (!ORDER_TRANSITIONS[order.status].includes("CANCELLED")) throw conflict("این سفارش قابل لغو نیست.");
    await releaseUnpaidOrder(tx, orderId, reason, byId);
    await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
    await tx.orderStatusHistory.create({ data: { orderId, status: "CANCELLED", description: reason, createdById: byId } });
    if (order.userId) await notify(tx, order.userId, "order_cancelled", { title: `سفارش ${order.number.toLocaleString("fa-IR")} لغو شد`, body: reason, link: `/account/orders/${order.number}`, data: { orderNumber: order.number } });
    await after?.(tx);
    return { ok: true };
  });
}
