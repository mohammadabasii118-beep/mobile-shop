import { Order, PaymentMethod } from '@prisma/client';
import { prisma } from '../../db/client';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import { randomId } from '../../utils/misc';
import { consumeCoupon, releaseCoupon, validateCoupon } from '../coupons/service';
import { audit } from '../admin/audit';
import { isPaymentMethodEnabled } from '../payments/service';
import { validateServiceName } from '../../utils/names';

const newOrderNumber = () => {
  const d = new Date();
  const ymd = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `VPN-${ymd}-${randomId(3).toUpperCase()}`;
};

export interface CreateOrderInput {
  userId: string;
  productId: string;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  renewalOfServiceId?: string;
}

export async function createOrder(input: CreateOrderInput): Promise<{ order: Order; reused: boolean }> {
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product || !product.isActive) throw new ValidationError('این پلن در دسترس نیست');

  if (!(await isPaymentMethodEnabled(input.paymentMethod))) throw new ValidationError('روش پرداخت انتخاب‌شده فعال نیست');

  if (input.renewalOfServiceId) {
    const svc = await prisma.vpnService.findUnique({ where: { id: input.renewalOfServiceId } });
    if (!svc || svc.userId !== input.userId) throw new ForbiddenError('سرویس متعلق به شما نیست');
    if (svc.provisioningStatus !== 'SUCCESS' || svc.status === 'CANCELLED') throw new ValidationError('این سرویس قابل تمدید نیست');
    if (svc.inboundId !== product.xuiInboundId || svc.provider !== product.xuiProviderId) {
      throw new ValidationError('این پلن برای تمدید این سرویس مناسب نیست');
    }
  }

  // Duplicate protection: reuse an open unpaid order for the same product/target.
  const existing = await prisma.order.findFirst({
    where: {
      userId: input.userId, productId: input.productId, status: 'PENDING_PAYMENT',
      renewalOfServiceId: input.renewalOfServiceId ?? null,
    },
    orderBy: { createdAt: 'desc' },
  });
  if (existing && !input.couponCode) return { order: existing, reused: true };

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const order = await prisma.$transaction(async (tx) => {
        let discount = 0;
        let couponId: string | undefined;
        if (input.couponCode) {
          const v = await validateCoupon(input.couponCode, input.userId, product.price, tx);
          discount = v.discount;
          couponId = v.coupon.id;
        }
        const o = await tx.order.create({
          data: {
            orderNumber: newOrderNumber(), userId: input.userId, productId: product.id,
            amount: product.price, discountAmount: discount, finalAmount: product.price - discount,
            currency: product.currency, paymentMethod: input.paymentMethod, couponId,
            renewalOfServiceId: input.renewalOfServiceId,
          },
        });
        if (couponId) await consumeCoupon(tx, couponId, input.userId, o.id);
        return o;
      });
      await audit({ actor: `user:${input.userId}`, action: 'order.create', target: 'Order', targetId: order.id, metadata: { amount: order.finalAmount } });
      return { order, reused: false };
    } catch (e: any) {
      if (e?.code === 'P2002' && String(e.meta?.target).includes('orderNumber')) continue;
      throw e;
    }
  }
  throw new ConflictError('could not allocate order number');
}

export async function getOrderForUser(userId: string, orderId: string) {
  const o = await prisma.order.findUnique({ where: { id: orderId }, include: { product: true, payments: true } });
  if (!o) throw new NotFoundError('order');
  if (o.userId !== userId) throw new ForbiddenError();
  return o;
}

export const listUserOrders = (userId: string, take = 10) =>
  prisma.order.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take, include: { product: true } });

export async function cancelOrder(userId: string, orderId: string) {
  await getOrderForUser(userId, orderId);
  const res = await prisma.$transaction(async (tx) => {
    const r = await tx.order.updateMany({ where: { id: orderId, userId, status: 'PENDING_PAYMENT' }, data: { status: 'CANCELLED' } });
    if (r.count !== 1) return false;
    await tx.payment.updateMany({ where: { orderId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    await releaseCoupon(tx, orderId);
    return true;
  });
  if (!res) throw new ConflictError('این سفارش قابل لغو نیست');
  await audit({ actor: `user:${userId}`, action: 'order.cancel', target: 'Order', targetId: orderId });
}

/** Expire stale unpaid orders (job). */
export async function expireStaleOrders(olderThanMinutes: number) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const stale = await prisma.order.findMany({ where: { status: 'PENDING_PAYMENT', createdAt: { lt: cutoff } }, select: { id: true, userId: true } });
  let n = 0;
  for (const o of stale) {
    try { await cancelOrder(o.userId, o.id); n++; } catch { /* raced with payment */ }
  }
  return n;
}

/** The customer may name the service before it is provisioned (afterwards use renameService). */
export async function setOrderServiceName(userId: string, orderId: string, rawName: string | null) {
  const o = await getOrderForUser(userId, orderId);
  if (!['PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAYMENT_REVIEW', 'PAID'].includes(o.status)) throw new ConflictError('سرویس این سفارش قبلاً ساخته شده؛ از «سرویس‌های من» نام را تغییر دهید');
  const name = rawName === null ? null : validateServiceName(rawName);
  await prisma.order.update({ where: { id: orderId }, data: { serviceName: name } });
  await audit({ actor: `user:${userId}`, action: 'order.set_name', target: 'Order', targetId: orderId, metadata: { name } });
  return name;
}
