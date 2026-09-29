import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { badRequest, conflict } from "@/lib/server/errors";
import { LOYALTY_DEFAULTS, loyaltySchema } from "@/lib/server/admin/loyalty-rules";

type Tx = Prisma.TransactionClient;
export type LoyaltyRules = ReturnType<typeof loyaltySchema.parse>;

export async function getLoyaltyRules(client: Tx | typeof db = db): Promise<LoyaltyRules> {
  const row = await client.siteSetting.findUnique({ where: { key: "loyalty" } });
  return loyaltySchema.parse({ ...LOYALTY_DEFAULTS, ...((row?.value as object) ?? {}) });
}

export interface PointsOp { userId: string; points: number; type: "earn" | "redeem" | "restore" | "reverse" | "admin_adjustment"; reference: string; description?: string; orderId?: string; byId?: string; floorAtZero?: boolean }

/** Only writer of loyalty points (independent from the wallet). Idempotent per reference; balance never negative. */
export async function pointsApply(tx: Tx, op: PointsOp) {
  if (!Number.isInteger(op.points) || op.points === 0) throw conflict("تعداد امتیاز نامعتبر است.", "invalid_points");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"loyalty:" + op.reference}))`;
  const existing = await tx.loyaltyTransaction.findUnique({ where: { reference: op.reference } });
  if (existing) return { transaction: existing, balance: existing.pointsAfter, replay: true as const };
  const acc = await tx.loyaltyAccount.upsert({ where: { userId: op.userId }, update: {}, create: { userId: op.userId } });
  let delta = op.points;
  if (delta < 0 && op.floorAtZero) delta = -Math.min(-delta, acc.points);
  if (delta === 0) return { transaction: null, balance: acc.points, replay: false as const };
  const rows = await tx.$queryRaw<{ points: number }[]>`UPDATE "LoyaltyAccount" SET "points" = "points" + ${delta} WHERE "id" = ${acc.id} AND "points" + ${delta} >= 0 RETURNING "points"`;
  if (rows.length !== 1) throw conflict("امتیاز کافی نیست.", "insufficient_points");
  const after = rows[0]!.points;
  const transaction = await tx.loyaltyTransaction.create({ data: { accountId: acc.id, type: op.type, points: delta, pointsBefore: after - delta, pointsAfter: after, reference: op.reference, description: op.description ?? null, orderId: op.orderId ?? null, createdById: op.byId ?? null } });
  return { transaction, balance: after, replay: false as const };
}

export async function getPointsBalance(userId: string) {
  return (await db.loyaltyAccount.findUnique({ where: { userId }, select: { points: true } }))?.points ?? 0;
}

/** Points earned by an order: retail-priced goods after coupon/points discounts, per the admin-defined rule. */
export function pointsForOrder(rules: LoyaltyRules, retailGoods: number, discount: number) {
  if (!rules.enabled || rules.amountPerPoint <= 0) return 0;
  const base = Math.max(0, retailGoods - discount);
  if (base < rules.minOrderTotal) return 0;
  return Math.floor(base / rules.amountPerPoint);
}

/** Awards the points for an order exactly once (reference earn:<orderId>), only once its payment is confirmed. */
export async function earnForOrder(tx: Tx, orderId: string, trigger: "payment" | "delivery") {
  const rules = await getLoyaltyRules(tx);
  if (!rules.enabled || rules.earnOn !== trigger) return null;
  const o = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!o || !o.userId || o.paymentStatus !== "PAID" || ["CANCELLED", "REFUNDED"].includes(o.status)) return null;
  const retailGoods = o.items.filter((i) => i.priceType === "retail").reduce((a, i) => a + i.total, 0);
  const points = pointsForOrder(rules, retailGoods, o.discountTotal);
  if (points <= 0) return null;
  const r = await pointsApply(tx, { userId: o.userId, points, type: "earn", reference: `earn:${orderId}`, description: `امتیاز سفارش ${o.number}`, orderId });
  return r.replay ? null : r;
}

/** On cancel / full refund: take back points that were earned and give back points that were spent. Both idempotent. */
export async function reverseOrderPoints(tx: Tx, orderId: string, byId?: string) {
  const o = await tx.order.findUnique({ where: { id: orderId } });
  if (!o?.userId) return;
  const earned = await tx.loyaltyTransaction.findUnique({ where: { reference: `earn:${orderId}` } });
  if (earned && earned.points > 0) await pointsApply(tx, { userId: o.userId, points: -earned.points, type: "reverse", reference: `earn-reverse:${orderId}`, description: `بازگشت امتیاز سفارش ${o.number} (لغو/مرجوعی)`, orderId, byId, floorAtZero: true });
  if (o.loyaltyPointsUsed > 0) await pointsApply(tx, { userId: o.userId, points: o.loyaltyPointsUsed, type: "restore", reference: `redeem-restore:${orderId}`, description: `بازگشت امتیاز مصرف‌شده سفارش ${o.number}`, orderId, byId });
}

export interface RedeemQuote { available: number; requested: number; applied: number; discount: number; error: string | null; enabled: boolean; pointValue: number; minPoints: number; maxPercent: number }

/** Validates a redeem request against the rules. `retailAfterCoupon` is the retail goods amount left after the coupon. */
export function quoteRedeem(rules: LoyaltyRules, balance: number, requested: number, retailAfterCoupon: number): RedeemQuote {
  const base = { available: balance, requested, applied: 0, discount: 0, error: null as string | null, enabled: rules.enabled && rules.redeemEnabled, pointValue: rules.pointValue, minPoints: rules.minRedeemPoints, maxPercent: rules.maxRedeemPercent };
  if (requested <= 0) return base;
  if (!base.enabled) return { ...base, error: "استفاده از امتیاز فعال نیست." };
  if (requested > balance) return { ...base, error: "امتیاز شما کافی نیست." };
  if (requested < rules.minRedeemPoints) return { ...base, error: `حداقل امتیاز برای استفاده ${rules.minRedeemPoints.toLocaleString("fa-IR")} است.` };
  const cap = Math.floor((Math.max(0, retailAfterCoupon) * rules.maxRedeemPercent) / 100);
  const maxPoints = Math.floor(cap / rules.pointValue);
  const applied = Math.min(requested, maxPoints);
  if (applied < rules.minRedeemPoints) return { ...base, error: "سقف تخفیف امتیاز برای این سفارش کمتر از حداقل استفاده است." };
  return { ...base, applied, discount: applied * rules.pointValue };
}
export const assertRedeem = (q: RedeemQuote) => { if (q.error) throw badRequest(q.error, "loyalty_invalid"); };
