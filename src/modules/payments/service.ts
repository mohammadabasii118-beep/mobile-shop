import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Payment, Prisma } from '@prisma/client';
import { prisma } from '../../db/client';
import { env } from '../../config/env';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import { normalizeDigits, sha256, formatMoney } from '../../utils/misc';
import { logger } from '../../utils/logger';
import { audit } from '../admin/audit';
import { getBool, getNumber, getSetting } from '../settings/service';
import { notifyAdmins, notifyUser } from '../notifications/service';
import * as T from '../notifications/templates';
import { OcrEngine, extractReceipt, ReceiptData } from './receipt';
import { assessRisk, RiskResult } from './risk';
import { CardToCardProvider } from '../../providers/payments/cardToCard';
import { CryptoPaymentProvider } from '../../providers/payments/crypto';
import { LedgerVerificationProvider, NullVerificationProvider } from '../../providers/payments/ledgerVerification';
import { PaymentProvider, PaymentVerificationProvider, VerificationOutcome } from '../../providers/payments/types';
import { runProvisioning } from '../vpn/provisioning';
import { PARTNER_AUTO_ACTOR, partnerAutoApproveVerdict } from '../partners/service';

interface Deps {
  verifiers: Record<string, PaymentVerificationProvider>;
  ocr?: OcrEngine;
  crypto: CryptoPaymentProvider;
}
const deps: Deps = {
  verifiers: { ledger: new LedgerVerificationProvider(), none: new NullVerificationProvider() },
  crypto: new CryptoPaymentProvider(),
};
export const setPaymentDeps = (d: Partial<Deps>) => Object.assign(deps, d);

const cardProvider = new CardToCardProvider((id) => verifyWithConfiguredProvider(id));
function providerFor(method: string): PaymentProvider {
  if (method === 'CARD_TO_CARD') return cardProvider;
  if (method === 'CRYPTO') return deps.crypto;
  throw new ValidationError('روش پرداخت پشتیبانی نمی‌شود');
}

async function verifyWithConfiguredProvider(paymentId: string): Promise<VerificationOutcome> {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  const order = await prisma.order.findUniqueOrThrow({ where: { id: payment.orderId } });
  const name = await getSetting('verification.provider');
  const v = deps.verifiers[name] ?? deps.verifiers.none;
  try {
    return await v.verifyPayment({ payment, order, now: new Date(), timeWindowMinutes: await getNumber('verification.timeWindowMinutes') });
  } catch (e: any) {
    logger.error({ err: String(e?.message), paymentId }, 'verification provider error');
    return { provider: v.name, result: 'UNKNOWN', reason: 'verification provider error' };
  }
}

export async function isPaymentMethodEnabled(method: string): Promise<boolean> {
  try { return await providerFor(method).isEnabled(); } catch { return false; }
}

/* ---------------------------- user-facing flow ---------------------------- */

export async function startPayment(userId: string, orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError('order');
  if (order.userId !== userId) throw new ForbiddenError();
  if (order.status !== 'PENDING_PAYMENT') throw new ConflictError('این سفارش در وضعیت پرداخت نیست');
  const provider = providerFor(order.paymentMethod);
  if (!(await provider.isEnabled())) throw new ValidationError('روش پرداخت فعال نیست');
  const r = await provider.createPayment(order);
  await audit({ actor: `user:${userId}`, action: 'payment.create', target: 'Payment', targetId: r.payment.id });
  return r;
}

async function saveReceipt(buf: Buffer, hash: string): Promise<string> {
  const dir = path.resolve(env().RECEIPT_DIR);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, `${hash}.bin`);
  await writeFile(file, buf, { mode: 0o600 });
  return file;
}

export interface SubmitReceiptInput {
  userId: string;
  orderId: string;
  fileId?: string;
  image?: Buffer;
  caption?: string;
  trackingCode?: string;
}

export function sanitizeTracking(s?: string): string | undefined {
  if (!s) return undefined;
  const t = normalizeDigits(s).replace(/[^A-Za-z0-9]/g, '');
  return t.length >= 5 && t.length <= 24 ? t : undefined;
}

export async function submitReceipt(input: SubmitReceiptInput) {
  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) throw new NotFoundError('order');
  if (order.userId !== input.userId) throw new ForbiddenError();
  if (order.status !== 'PENDING_PAYMENT') throw new ConflictError('برای این سفارش قبلاً پرداخت ثبت شده است');
  if (order.paymentMethod !== 'CARD_TO_CARD') throw new ValidationError('ثبت رسید فقط برای کارت‌به‌کارت است');
  if (!input.image && !input.fileId && !input.trackingCode && !input.caption) throw new ValidationError('رسید یا کد پیگیری لازم است');

  const { payment } = await startPayment(input.userId, input.orderId);
  const hash = input.image ? sha256(input.image) : undefined;
  const receiptPath = input.image && hash ? await saveReceipt(input.image, hash) : undefined;
  const receiptData = await extractReceipt(deps.ocr, input.image, input.caption);
  const tracking = sanitizeTracking(input.trackingCode) ?? sanitizeTracking(receiptData.trackingCode);

  // Atomic claim: a replayed callback / double send cannot submit twice.
  const claimed = await prisma.$transaction(async (tx) => {
    const r = await tx.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'SUBMITTED' } });
    if (r.count !== 1) return false;
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        receiptFileId: input.fileId, receiptPath, receiptHash: hash, trackingCode: tracking,
        receiptData: receiptData as unknown as Prisma.InputJsonValue, submittedAmount: receiptData.amount, submittedAt: new Date(),
      },
    });
    await tx.order.updateMany({ where: { id: order.id, status: 'PENDING_PAYMENT' }, data: { status: 'PAYMENT_SUBMITTED' } });
    return true;
  });
  if (!claimed) throw new ConflictError('رسید قبلاً ثبت شده است');

  await audit({ actor: `user:${input.userId}`, action: 'payment.submit', target: 'Payment', targetId: payment.id, metadata: { tracking: !!tracking, hasImage: !!input.image } });
  await notifyUser(input.userId, 'payment_submitted', await T.paymentSubmitted(order.orderNumber), { html: true, buttons: [[{ text: '📍 پیگیری سفارش', data: `ov:${order.id}` }], [{ text: '🏠 منوی اصلی', data: 'menu:main' }]] });
  await processPayment(payment.id);
  return prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
}

/* ------------------------- verification + decision ------------------------ */

export type Decision = 'AUTO_APPROVE' | 'NEEDS_REVIEW' | 'REJECT' | 'NOOP';

export async function processPayment(paymentId: string): Promise<Decision> {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });
  if (payment.status !== 'SUBMITTED' && payment.status !== 'NEEDS_REVIEW') return 'NOOP';
  const order = payment.order;

  const mode = await getSetting('verification.mode');
  const outcome = await providerFor(payment.provider).verifyPayment(paymentId);

  const last = await prisma.paymentVerification.findFirst({ where: { paymentId }, orderBy: { createdAt: 'desc' } });
  if (!last || last.result !== outcome.result || last.reason !== (outcome.reason ?? null)) {
    await prisma.paymentVerification.create({
      data: { paymentId, provider: outcome.provider, result: outcome.result, reason: outcome.reason, evidence: (outcome.evidence ?? undefined) as Prisma.InputJsonValue | undefined },
    });
  }

  // ---- risk ----
  const rd = (payment.receiptData ?? {}) as unknown as ReceiptData;
  const day = new Date(Date.now() - 86_400_000);
  const [dupTrack, dupReceipt, subs, rejected, approved, bankTxClaimedElsewhere] = await Promise.all([
    payment.trackingCode
      ? prisma.payment.count({ where: { id: { not: paymentId }, trackingCode: payment.trackingCode, status: { notIn: ['CANCELLED', 'PENDING'] } } })
      : 0,
    payment.receiptHash ? prisma.payment.count({ where: { id: { not: paymentId }, receiptHash: payment.receiptHash, status: { notIn: ['CANCELLED', 'PENDING'] } } }) : 0,
    prisma.payment.count({ where: { userId: payment.userId, submittedAt: { gte: day } } }),
    prisma.payment.count({ where: { userId: payment.userId, status: 'REJECTED' } }),
    prisma.payment.count({ where: { userId: payment.userId, status: 'APPROVED' } }),
    outcome.bankTransactionId ? prisma.bankTransaction.count({ where: { id: outcome.bankTransactionId, claimedByPaymentId: { not: null } } }) : 0,
  ]);
  const risk: RiskResult = assessRisk(
    {
      orderAmount: order.finalAmount, ocrAmount: rd.amount, submittedAmount: payment.submittedAmount ?? undefined,
      trackingCode: payment.trackingCode ?? undefined, trackingMatchedLedger: outcome.matchedBy === 'tracking', matchedBy: outcome.matchedBy,
      duplicateTracking: dupTrack > 0 || bankTxClaimedElsewhere > 0, duplicateReceipt: dupReceipt > 0,
      ocrConfidence: rd.source === 'ocr' ? rd.confidence : undefined, ocrMinConfidence: await getNumber('risk.ocrMinConfidence'),
      receiptTimeBeforeOrder: !!rd.occurredAt && new Date(rd.occurredAt).getTime() < order.createdAt.getTime() - 5 * 60_000,
      submissions24h: subs, maxSubmissions24h: await getNumber('risk.maxSubmissions24h'),
      userRejectedCount: rejected, userApprovedCount: approved, verificationVerified: outcome.result === 'VERIFIED',
    },
    { mediumAt: await getNumber('risk.mediumAt'), highAt: await getNumber('risk.highAt') },
  );
  await prisma.payment.update({
    where: { id: paymentId },
    data: { verificationStatus: outcome.result, riskScore: risk.score, riskLevel: risk.level, riskFactors: risk.factors as unknown as Prisma.InputJsonValue },
  });

  // ---- decision (safe by default) ----
  const highAction = await getSetting('risk.highAction');
  const receiptOnlyOk = await getBool('verification.allowReceiptOnlyAutoApprove');
  let decision: Decision;
  if (outcome.result === 'REJECTED' && risk.level !== 'LOW') decision = highAction === 'REJECT' ? 'REJECT' : 'NEEDS_REVIEW';
  else if (risk.level === 'HIGH') decision = highAction === 'REJECT' ? 'REJECT' : 'NEEDS_REVIEW';
  else if (mode !== 'AUTO_VERIFICATION') decision = 'NEEDS_REVIEW';
  else if (outcome.result === 'VERIFIED' && risk.level === 'LOW') decision = 'AUTO_APPROVE';
  else if (outcome.result !== 'VERIFIED' && receiptOnlyOk && risk.level === 'LOW') decision = 'AUTO_APPROVE';
  else decision = 'NEEDS_REVIEW';

  // Trusted-partner exception (opt-in, narrow): see partnerAutoApproveVerdict.
  if (decision === 'NEEDS_REVIEW') {
    const v = await partnerAutoApproveVerdict({ userId: payment.userId, paymentId, amount: order.finalAmount, verification: outcome.result, risk });
    if (v.ok) {
      const r = await approvePayment(paymentId, { actor: PARTNER_AUTO_ACTOR, auto: true, bankTransactionId: outcome.bankTransactionId });
      if (r.changed) {
        await notifyAdmins('partner_auto_approved', `🤝 سفارش همکار خودکار تأیید شد\nسفارش: ${order.orderNumber}\nمبلغ: ${formatMoney(order.finalAmount)}\n⚠️ تأیید بانکی انجام نشد (${outcome.result}) — در صورت نیاز واریز را کنترل کنید.`, { roles: ['PAYMENT_ADMIN'], buttons: [[{ text: '🔎 مشاهده', data: `ap:v:${paymentId}` }]], dedupeKey: `partner_auto:${paymentId}` });
        return 'AUTO_APPROVE';
      }
    }
  }
  if (decision === 'AUTO_APPROVE') {
    const r = await approvePayment(paymentId, { actor: 'auto', auto: true, bankTransactionId: outcome.bankTransactionId });
    if (r.changed) return 'AUTO_APPROVE';
    decision = 'NEEDS_REVIEW';
  }
  if (decision === 'REJECT') {
    await rejectPayment(paymentId, { actor: 'auto', reason: `ریسک بالا: ${risk.factors.map((f) => f.code).join(', ')}` });
    return 'REJECT';
  }
  await markNeedsReview(paymentId, risk, outcome);
  return 'NEEDS_REVIEW';
}

async function markNeedsReview(paymentId: string, risk: RiskResult, outcome: VerificationOutcome) {
  const res = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const r = await tx.payment.updateMany({ where: { id: paymentId, status: 'SUBMITTED' }, data: { status: 'NEEDS_REVIEW' } });
    await tx.order.updateMany({ where: { id: p.orderId, status: 'PAYMENT_SUBMITTED' }, data: { status: 'PAYMENT_REVIEW' } });
    return r.count === 1;
  });
  if (!res) return;
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });
  await audit({ actor: 'system', action: 'payment.needs_review', target: 'Payment', targetId: paymentId, metadata: { risk, verification: outcome.result, reason: outcome.reason } });
  await notifyAdmins(
    risk.level === 'HIGH' ? 'high_risk_payment' : 'payment_needs_review',
    `${risk.level === 'HIGH' ? '🚨 پرداخت پرریسک' : '🔎 پرداخت نیازمند بررسی'}\nسفارش: ${p.order.orderNumber}\nمبلغ: ${formatMoney(p.amount)}\nریسک: ${risk.level} (${risk.score})\nنتیجه تأیید: ${outcome.result}${outcome.reason ? ` — ${outcome.reason}` : ''}`,
    { roles: ['PAYMENT_ADMIN'], buttons: [[{ text: '🔎 مشاهده', data: `ap:v:${paymentId}` }]], dedupeKey: `needs_review:${paymentId}:${outcome.result}` },
  );
  await notifyUser(p.userId, 'payment_review', await T.paymentReview(p.order.orderNumber), { dedupeKey: `user_review:${paymentId}`, html: true, buttons: [[{ text: '📍 پیگیری سفارش', data: `ov:${p.orderId}` }]] });
}

/* ------------------------------ state changes ----------------------------- */

export interface ApproveOpts { actor: string; auto?: boolean; bankTransactionId?: string }

/** Idempotent: a second approve (double click / replay) returns {changed:false} and creates nothing. */
export async function approvePayment(paymentId: string, opts: ApproveOpts): Promise<{ changed: boolean; payment?: Payment }> {
  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!p) throw new NotFoundError('payment');
      const r = await tx.payment.updateMany({
        where: { id: paymentId, status: { in: ['SUBMITTED', 'NEEDS_REVIEW'] } },
        data: { status: 'APPROVED', autoApproved: !!opts.auto, reviewedAt: new Date(), reviewedBy: opts.actor },
      });
      if (r.count !== 1) return null;
      if (opts.bankTransactionId) {
        const c = await tx.bankTransaction.updateMany({ where: { id: opts.bankTransactionId, claimedByPaymentId: null }, data: { claimedByPaymentId: paymentId } });
        if (c.count !== 1 && opts.auto) throw new ConflictError('bank transaction already claimed');
      }
      const o = await tx.order.updateMany({
        where: { id: p.orderId, status: { in: ['PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAYMENT_REVIEW'] } },
        data: { status: 'PAID' },
      });
      if (o.count !== 1) throw new ConflictError('order is not payable (cancelled or already paid)');
      const ord = await tx.order.findUniqueOrThrow({ where: { id: p.orderId } });
      await tx.provisioningTask.upsert({
        where: { orderId: ord.id },
        create: { orderId: ord.id, kind: ord.renewalOfServiceId ? 'RENEW' : 'CREATE', serviceId: ord.renewalOfServiceId },
        update: {},
      });
      await audit({ actor: opts.actor, action: opts.auto ? 'payment.auto_approve' : 'payment.approve', target: 'Payment', targetId: paymentId, metadata: { orderId: ord.id, bankTransactionId: opts.bankTransactionId } }, tx);
      return ord;
    });
  } catch (e) {
    if (opts.auto && e instanceof ConflictError) return { changed: false };
    throw e;
  }
  if (!order) return { changed: false };

  await notifyUser(order.userId, 'payment_verified', await T.paymentVerified(order.orderNumber), { dedupeKey: `verified:${paymentId}`, html: true });
  try {
    await runProvisioning(order.id);
  } catch (e: any) {
    logger.error({ err: String(e?.message), orderId: order.id }, 'provisioning threw after approval');
  }
  return { changed: true, payment: await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } }) };
}

export async function rejectPayment(paymentId: string, opts: { actor: string; reason: string }) {
  const done = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!p) throw new NotFoundError('payment');
    const r = await tx.payment.updateMany({
      where: { id: paymentId, status: { in: ['SUBMITTED', 'NEEDS_REVIEW'] } },
      data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: opts.actor, rejectionReason: opts.reason.slice(0, 300) },
    });
    if (r.count !== 1) return null;
    // allow the user to submit a fresh receipt
    await tx.order.updateMany({ where: { id: p.orderId, status: { in: ['PAYMENT_SUBMITTED', 'PAYMENT_REVIEW'] } }, data: { status: 'PENDING_PAYMENT' } });
    await audit({ actor: opts.actor, action: opts.actor === 'auto' ? 'payment.auto_reject' : 'payment.reject', target: 'Payment', targetId: paymentId, metadata: { reason: opts.reason } }, tx);
    return p;
  });
  if (!done) return { changed: false };
  const order = await prisma.order.findUniqueOrThrow({ where: { id: done.orderId } });
  await notifyUser(done.userId, 'payment_rejected', await T.paymentRejected(order.orderNumber, opts.reason), { html: true, buttons: [[{ text: '📤 ارسال رسید جدید', data: `rc:${order.id}` }], [{ text: '🎫 پشتیبانی', data: 'menu:support' }]] });
  return { changed: true };
}

export async function requestReview(paymentId: string, actor: string, note?: string) {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  const r = await prisma.payment.updateMany({ where: { id: paymentId, status: 'SUBMITTED' }, data: { status: 'NEEDS_REVIEW' } });
  if (r.count === 1) await prisma.order.updateMany({ where: { id: p.orderId, status: 'PAYMENT_SUBMITTED' }, data: { status: 'PAYMENT_REVIEW' } });
  await audit({ actor, action: 'payment.request_review', target: 'Payment', targetId: paymentId, metadata: { note } });
  return r.count === 1;
}

/** Re-run verification for payments waiting on the ledger (job + after each ledger ingest). */
export async function reverifyPending(maxAgeHours = 48): Promise<number> {
  const since = new Date(Date.now() - maxAgeHours * 3_600_000);
  const rows = await prisma.payment.findMany({
    where: { status: { in: ['SUBMITTED', 'NEEDS_REVIEW'] }, provider: 'CARD_TO_CARD', submittedAt: { gte: since } },
    select: { id: true },
  });
  let approved = 0;
  for (const r of rows) {
    try { if ((await processPayment(r.id)) === 'AUTO_APPROVE') approved++; } catch (e: any) { logger.error({ err: String(e?.message), id: r.id }, 'reverify failed'); }
  }
  return approved;
}

/* ------------------------------ admin queries ----------------------------- */

export type PaymentFilter = 'pending' | 'submitted' | 'auto' | 'review' | 'approved' | 'rejected';
export function filterWhere(f: PaymentFilter): Prisma.PaymentWhereInput {
  switch (f) {
    case 'pending': return { status: 'PENDING' };
    case 'submitted': return { status: 'SUBMITTED' };
    case 'auto': return { status: 'APPROVED', autoApproved: true };
    case 'review': return { status: 'NEEDS_REVIEW' };
    case 'approved': return { status: 'APPROVED' };
    case 'rejected': return { status: 'REJECTED' };
  }
}
export const listPayments = (f: PaymentFilter, skip = 0, take = 8) =>
  prisma.payment.findMany({ where: filterWhere(f), orderBy: { createdAt: 'desc' }, skip, take, include: { order: true, user: true } });

export async function getPaymentDetail(id: string) {
  const p = await prisma.payment.findUnique({
    where: { id },
    include: { order: { include: { product: true, service: true } }, user: true, verifications: { orderBy: { createdAt: 'asc' } }, bankTx: true },
  });
  if (!p) throw new NotFoundError('payment');
  return p;
}

export async function ingestBankTransaction(input: {
  externalId: string; trackingCode?: string; amount: number; destination?: string; occurredAt: Date; status?: string; source: string; raw?: unknown;
}) {
  const tracking = sanitizeTracking(input.trackingCode);
  try {
    const tx = await prisma.bankTransaction.create({
      data: { externalId: input.externalId, trackingCode: tracking, amount: input.amount, destination: input.destination, occurredAt: input.occurredAt, status: input.status ?? 'SUCCESS', source: input.source, raw: input.raw as Prisma.InputJsonValue },
    });
    await audit({ actor: 'system', action: 'bank_tx.ingest', target: 'BankTransaction', targetId: tx.id, metadata: { amount: tx.amount, source: input.source } });
    const auto = await reverifyPending();
    return { created: true, id: tx.id, autoApproved: auto };
  } catch (e: any) {
    if (e?.code === 'P2002') return { created: false };
    throw e;
  }
}
