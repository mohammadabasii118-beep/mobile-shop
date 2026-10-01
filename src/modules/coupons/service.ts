import { CouponType } from '@prisma/client';
import { prisma, Tx } from '../../db/client';
import { ValidationError } from '../../utils/errors';
import { audit } from '../admin/audit';

export function computeDiscount(type: CouponType, value: number, amount: number): number {
  const d = type === 'PERCENT' ? Math.floor((amount * Math.min(value, 100)) / 100) : value;
  return Math.max(0, Math.min(d, amount));
}

export async function validateCoupon(code: string, userId: string, amount: number, db: Tx | typeof prisma = prisma) {
  const c = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!c || !c.isActive) throw new ValidationError('کد تخفیف نامعتبر است');
  if (c.expiresAt && c.expiresAt < new Date()) throw new ValidationError('کد تخفیف منقضی شده است');
  if (c.maxUses !== null && c.usedCount >= c.maxUses) throw new ValidationError('ظرفیت کد تخفیف تمام شده است');
  const used = await db.couponUsage.count({ where: { couponId: c.id, userId } });
  if (used > 0) throw new ValidationError('شما قبلاً از این کد استفاده کرده‌اید');
  return { coupon: c, discount: computeDiscount(c.type, c.value, amount) };
}

/** Atomically consume a use inside the order transaction (race-safe against maxUses). */
export async function consumeCoupon(tx: Tx, couponId: string, userId: string, orderId: string) {
  const c = await tx.coupon.findUniqueOrThrow({ where: { id: couponId } });
  const res = await tx.coupon.updateMany({
    where: { id: couponId, isActive: true, ...(c.maxUses !== null ? { usedCount: { lt: c.maxUses } } : {}) },
    data: { usedCount: { increment: 1 } },
  });
  if (res.count !== 1) throw new ValidationError('ظرفیت کد تخفیف تمام شده است');
  await tx.couponUsage.create({ data: { couponId, userId, orderId } });
}

export async function releaseCoupon(tx: Tx, orderId: string) {
  const u = await tx.couponUsage.findUnique({ where: { orderId } });
  if (!u) return;
  await tx.couponUsage.delete({ where: { orderId } });
  await tx.coupon.update({ where: { id: u.couponId }, data: { usedCount: { decrement: 1 } } });
}

export async function createCoupon(actor: string, input: { code: string; type: CouponType; value: number; maxUses?: number; expiresAt?: Date }) {
  if (input.value <= 0 || (input.type === 'PERCENT' && input.value > 100)) throw new ValidationError('مقدار نامعتبر');
  const c = await prisma.coupon.create({ data: { ...input, code: input.code.trim().toUpperCase() } });
  await audit({ actor, action: 'coupon.create', target: 'Coupon', targetId: c.id, metadata: input });
  return c;
}
export const listCoupons = () => prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
