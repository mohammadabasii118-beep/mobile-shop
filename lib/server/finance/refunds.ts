import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma, Refund } from "@/lib/generated/prisma/client";
import { AppError, badRequest, conflict, forbidden, notFound } from "@/lib/server/errors";
import { audit, type AdminCtx } from "@/lib/server/admin/core";
import { walletApply } from "@/lib/server/finance/wallet";
import { reverseOrderPoints, reversePartialPoints } from "@/lib/server/finance/loyalty";
import { restockOrder, rollbackCoupon } from "@/lib/server/finance/lifecycle";
import { notify } from "@/lib/server/notify";
import type { SessionUser } from "@/lib/server/auth/session";

type Tx = Prisma.TransactionClient;
const OPEN = ["AWAITING_CUSTOMER", "PENDING_BANK"] as const;

/**
 * Money that reached us for the order, split by where it came from:
 *  - wallet part: refundable to the wallet only
 *  - card part (card-to-card, confirmed by staff): refundable to the wallet or, manually, to the bank
 * Open refunds "reserve" their amount, so two refunds can never add up to more than was paid.
 */
export async function refundSummary(tx: Tx, orderId: string) {
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true, refunds: true } });
  const pay = o.payments[0];
  const cardConfirmed = !!pay && (pay.status === "PAID" || pay.status === "REFUNDED");
  const cardPaid = cardConfirmed && pay!.provider !== "wallet" ? pay!.amount : 0;
  const walletPaid = o.paymentStatus === "PAID" || o.paymentStatus === "REFUNDED" ? o.walletUsed : 0;
  const totalPaid = cardPaid + walletPaid;
  const live = o.refunds.filter((r) => r.status === "COMPLETED" || (OPEN as readonly string[]).includes(r.status));
  const reserved = live.reduce((a, r) => a + r.amount, 0);
  const reservedBank = live.filter((r) => r.method === "bank").reduce((a, r) => a + r.amount, 0);
  const completed = o.refunds.filter((r) => r.status === "COMPLETED").reduce((a, r) => a + r.amount, 0);
  return { order: o, cardPaid, walletPaid, totalPaid, reserved, completed, refundable: totalPaid - reserved, bankRefundable: Math.min(totalPaid - reserved, cardPaid - reservedBank) };
}

/** Separation of duties for bank refunds. On unless an owner explicitly turns it off in settings ("finance"). */
async function fourEyesEnabled(tx: Tx) {
  const row = await tx.siteSetting.findUnique({ where: { key: "finance" } });
  return (row?.value as { fourEyes?: boolean } | null)?.fourEyes !== false;
}

export const requestSchema = z.object({
  method: z.enum(["wallet", "bank"]),
  amount: z.coerce.number().int("مبلغ را به تومان و عدد صحیح وارد کنید.").min(1),
  reason: z.string().trim().min(3, "دلیل را بنویسید.").max(300),
  restock: z.boolean().default(false),
  bankNote: z.string().trim().max(300).optional(),
  idempotencyKey: z.string().trim().min(8).max(80).optional(),
});
export const completeSchema = z.object({
  bankReference: z.string().trim().regex(/^[A-Za-z0-9\-_/.]{4,40}$/, "شماره پیگیری بانکی را درست وارد کنید (۴ تا ۴۰ حرف یا عدد)."),
  confirm: z.literal(true, { error: "تأیید واریز الزامی است." }),
});

/** Staff asks for a refund. Nothing moves yet: wallet refunds wait for the customer, bank refunds wait for an approver. */
export async function requestRefund(number: number, body: unknown, a: AdminCtx) {
  const d = requestSchema.parse(body);
  return db.$transaction(async (tx) => {
    const ord = await tx.order.findUnique({ where: { number }, select: { id: true } });
    if (!ord) throw notFound("سفارش پیدا نشد.");
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${ord.id} FOR UPDATE`; // serialise refunds of one order
    if (d.idempotencyKey) {
      const dup = await tx.refund.findUnique({ where: { idempotencyKey: d.idempotencyKey } });
      if (dup) { if (dup.orderId !== ord.id) throw conflict("کلید تکراری متعلق به سفارش دیگری است.", "key_reuse"); return dup; }
    }
    const s = await refundSummary(tx, ord.id);
    const o = s.order;
    if (["CANCELLED", "REFUNDED"].includes(o.status)) throw conflict("این سفارش بسته شده است.", "order_closed");
    if (s.totalPaid <= 0) throw conflict("برای این سفارش پرداخت تأییدشده‌ای وجود ندارد؛ سفارش پرداخت‌نشده را لغو کنید.", "nothing_paid");
    if (d.amount > s.refundable) throw conflict(`مبلغ بیشتر از سقف قابل بازگشت (${s.refundable.toLocaleString("fa-IR")} تومان) است.`, "refund_exceeds");
    if (d.method === "bank") {
      if (d.amount > s.bankRefundable) throw conflict(`بازگشت بانکی فقط تا سقف مبلغ پرداخت‌شده با کارت (${Math.max(0, s.bankRefundable).toLocaleString("fa-IR")} تومان) ممکن است؛ مبلغ پرداخت‌شده با کیف پول فقط به کیف پول برمی‌گردد.`, "bank_exceeds");
      if (!d.bankNote) throw badRequest("مقصد واریز (شماره کارت/شبا) را یادداشت کنید.", "bank_note_required");
    }
    const r = await tx.refund.create({ data: { orderId: o.id, method: d.method, amount: d.amount, status: d.method === "wallet" ? "AWAITING_CUSTOMER" : "PENDING_BANK", reason: d.reason, restock: d.restock, bankNote: d.method === "bank" ? d.bankNote : null, idempotencyKey: d.idempotencyKey ?? null, requestedById: a.admin.id } });
    await tx.orderStatusHistory.create({ data: { orderId: o.id, status: o.status, description: `درخواست بازگشت وجه ${d.method === "wallet" ? "به کیف پول" : "بانکی"} (${d.amount.toLocaleString("fa-IR")} تومان): ${d.reason}`, createdById: a.admin.id } });
    if (o.userId) await notify(tx, o.userId, "refund_requested", { title: d.method === "wallet" ? "بازگشت وجه به کیف پول در انتظار تأیید شما" : "بازگشت وجه سفارش شما ثبت شد", body: d.method === "wallet" ? `مبلغ ${d.amount.toLocaleString("fa-IR")} تومان آماده واریز به کیف پول است؛ برای تأیید وارد سفارش شوید.` : `مبلغ ${d.amount.toLocaleString("fa-IR")} تومان پس از تأیید مدیر به حساب شما واریز و شماره پیگیری اعلام می‌شود.`, link: `/account/orders/${o.number}`, data: { refundId: r.id, orderNumber: o.number } });
    await audit(a, "refund.request", "refund", r.id, undefined, { orderNumber: o.number, method: d.method, amount: d.amount, reason: d.reason, restock: d.restock }, tx);
    return r;
  });
}

/** Runs after a refund's money has really moved: restock (once), and close the order when everything paid is back. */
async function afterCompleted(tx: Tx, refund: Refund, actorId: string) {
  const s = await refundSummary(tx, refund.orderId);
  const o = s.order;
  if (refund.restock) await restockOrder(tx, o.id, "refund", `مرجوعی — ${refund.reason}`, actorId);
  const full = s.completed >= s.totalPaid;
  if (full) {
    await tx.payment.updateMany({ where: { orderId: o.id, status: "PAID" }, data: { status: "REFUNDED" } });
    await tx.order.update({ where: { id: o.id }, data: { status: "REFUNDED", paymentStatus: "REFUNDED" } });
    await tx.orderStatusHistory.create({ data: { orderId: o.id, status: "REFUNDED", description: "کل مبلغ پرداخت‌شده بازگردانده شد.", createdById: actorId } });
    await rollbackCoupon(tx, o.id);
    await reverseOrderPoints(tx, o.id, actorId);
  } else {
    await reversePartialPoints(tx, o.id, refund.id, refund.amount, s.totalPaid, actorId);
    await tx.orderStatusHistory.create({ data: { orderId: o.id, status: o.status, description: `بازگشت وجه جزئی: ${refund.amount.toLocaleString("fa-IR")} تومان`, createdById: actorId } });
  }
  if (o.userId) await notify(tx, o.userId, "refund_completed", { title: "بازگشت وجه انجام شد", body: `${refund.amount.toLocaleString("fa-IR")} تومان ${refund.method === "wallet" ? "به کیف پول شما واریز شد." : `به حساب شما واریز شد. شماره پیگیری: ${refund.bankReference}`}`, link: `/account/orders/${o.number}`, data: { refundId: refund.id } });
}

/** Customer confirms a wallet refund → the wallet is credited (idempotent) and the refund completes. */
export async function acceptWalletRefund(user: SessionUser, refundId: string) {
  return db.$transaction(async (tx) => {
    const r = await tx.refund.findUnique({ where: { id: refundId }, include: { order: { select: { userId: true, number: true } } } });
    if (!r || r.order.userId !== user.id) throw notFound("درخواست پیدا نشد.");
    if (r.method !== "wallet") throw conflict("این بازگشت وجه از نوع بانکی است.", "not_wallet");
    const claimed = await tx.refund.updateMany({ where: { id: refundId, status: "AWAITING_CUSTOMER" }, data: { status: "COMPLETED", respondedAt: new Date(), completedAt: new Date(), completedById: user.id } });
    if (claimed.count !== 1) throw conflict("این درخواست قبلاً بررسی شده است.", "already_handled");
    await walletApply(tx, { userId: user.id, direction: "in", amount: r.amount, type: "refund_credit", reference: `refund:${r.id}`, description: `بازگشت وجه سفارش ${r.order.number}`, orderId: r.orderId });
    const done = await tx.refund.findUniqueOrThrow({ where: { id: refundId } });
    await afterCompleted(tx, done, user.id);
    await audit({ admin: user, ip: "customer" }, "refund.wallet_accept", "refund", refundId, { status: "AWAITING_CUSTOMER" }, { status: "COMPLETED", amount: r.amount, orderNumber: r.order.number }, tx);
    return { status: "COMPLETED" as const };
  });
}

export async function declineWalletRefund(user: SessionUser, refundId: string) {
  return db.$transaction(async (tx) => {
    const r = await tx.refund.findUnique({ where: { id: refundId }, include: { order: { select: { userId: true, number: true } } } });
    if (!r || r.order.userId !== user.id) throw notFound("درخواست پیدا نشد.");
    const claimed = await tx.refund.updateMany({ where: { id: refundId, status: "AWAITING_CUSTOMER" }, data: { status: "REJECTED", respondedAt: new Date() } });
    if (claimed.count !== 1) throw conflict("این درخواست قبلاً بررسی شده است.", "already_handled");
    await tx.orderStatusHistory.create({ data: { orderId: r.orderId, status: (await tx.order.findUniqueOrThrow({ where: { id: r.orderId } })).status, description: "مشتری بازگشت وجه به کیف پول را نپذیرفت.", createdById: user.id } });
    await audit({ admin: user, ip: "customer" }, "refund.wallet_decline", "refund", refundId, { status: "AWAITING_CUSTOMER" }, { status: "REJECTED" }, tx);
    return { status: "REJECTED" as const };
  });
}

/** Approver (refund.approve) confirms the manual bank transfer and records the bank tracking number. */
export async function completeBankRefund(refundId: string, body: unknown, a: AdminCtx) {
  if (!a.admin.permissions.includes("refund.approve")) throw forbidden("تأیید بازگشت وجه بانکی نیازمند مجوز «تأیید بازگشت وجه» است.");
  const d = completeSchema.parse(body);
  return db.$transaction(async (tx) => {
    const r = await tx.refund.findUnique({ where: { id: refundId } });
    if (!r) throw notFound("درخواست پیدا نشد.");
    if (r.method !== "bank") throw conflict("این بازگشت وجه بانکی نیست.", "not_bank");
    if (r.requestedById && r.requestedById === a.admin.id && (await fourEyesEnabled(tx))) throw new AppError(403, "four_eyes", "درخواست‌دهنده نمی‌تواند همان بازگشت وجه را تأیید کند؛ مدیر دیگری باید تأیید کند.");
    const claimed = await tx.refund.updateMany({ where: { id: refundId, status: "PENDING_BANK" }, data: { status: "COMPLETED", bankReference: d.bankReference, completedById: a.admin.id, completedAt: new Date() } });
    if (claimed.count !== 1) throw conflict("این بازگشت وجه قابل تکمیل نیست (قبلاً انجام یا لغو شده).", "already_handled");
    const done = await tx.refund.findUniqueOrThrow({ where: { id: refundId } });
    await afterCompleted(tx, done, a.admin.id);
    await audit(a, "refund.bank_complete", "refund", refundId, { status: "PENDING_BANK" }, { status: "COMPLETED", bankReference: d.bankReference, amount: r.amount }, tx);
    return { status: "COMPLETED" as const };
  });
}

export async function cancelRefund(refundId: string, body: unknown, a: AdminCtx) {
  const { reason } = z.object({ reason: z.string().trim().min(3, "دلیل لازم است.").max(300) }).parse(body);
  return db.$transaction(async (tx) => {
    const r = await tx.refund.findUnique({ where: { id: refundId }, include: { order: { select: { userId: true, number: true, status: true } } } });
    if (!r) throw notFound("درخواست پیدا نشد.");
    const claimed = await tx.refund.updateMany({ where: { id: refundId, status: { in: [...OPEN] } }, data: { status: "CANCELLED", respondedAt: new Date() } });
    if (claimed.count !== 1) throw conflict("فقط درخواست‌های باز قابل لغو هستند.", "not_open");
    await tx.orderStatusHistory.create({ data: { orderId: r.orderId, status: r.order.status, description: `درخواست بازگشت وجه لغو شد: ${reason}`, createdById: a.admin.id } });
    await audit(a, "refund.cancel", "refund", refundId, { status: r.status }, { status: "CANCELLED", reason }, tx);
    return { status: "CANCELLED" as const };
  });
}

export async function listRefunds(status: string | null, take = 30, skip = 0) {
  const where: Prisma.RefundWhereInput = status && ["AWAITING_CUSTOMER", "PENDING_BANK", "COMPLETED", "REJECTED", "CANCELLED"].includes(status) ? { status: status as Refund["status"] } : {};
  const [items, total] = await Promise.all([
    db.refund.findMany({ where, orderBy: { createdAt: "desc" }, take, skip, include: { order: { select: { number: true, customerName: true, customerPhone: true, total: true } } } }),
    db.refund.count({ where }),
  ]);
  return { items, total, pages: Math.max(1, Math.ceil(total / take)) };
}
