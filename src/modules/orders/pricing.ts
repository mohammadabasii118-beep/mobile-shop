import { Prisma } from '@prisma/client';
import { prisma } from '../../db/client';
import { ValidationError } from '../../utils/errors';
import { getBool } from '../settings/service';
import { validateCoupon } from '../coupons/service';
import { partnerDiscountFor } from '../partners/service';

type Db = Prisma.TransactionClient | typeof prisma;

export interface Quote {
  price: number;
  partnerPercent: number;
  partnerDiscount: number;
  couponId?: string;
  couponCode?: string;
  couponDiscount: number;
  /** partner + coupon (what Order.discountAmount stores) */
  discount: number;
  final: number;
}

/**
 * The ONE place that prices an order (used by the order summary and by order creation, so they can never disagree).
 * Partner discount first; a coupon applies to the already reduced price, and only if `partner.stackCoupons` allows it.
 */
export async function quote(userId: string, price: number, couponCode: string | undefined, db: Db = prisma): Promise<Quote> {
  const partner = await partnerDiscountFor(userId, price, db);
  let couponDiscount = 0;
  let couponId: string | undefined;
  let code: string | undefined;
  if (couponCode) {
    if (partner.amount > 0 && !(await getBool('partner.stackCoupons'))) throw new ValidationError('کد تخفیف همراه با تخفیف همکاری قابل استفاده نیست');
    const v = await validateCoupon(couponCode, userId, price - partner.amount, db);
    couponDiscount = v.discount;
    couponId = v.coupon.id;
    code = v.coupon.code;
  }
  const discount = partner.amount + couponDiscount;
  return { price, partnerPercent: partner.percent, partnerDiscount: partner.amount, couponId, couponCode: code, couponDiscount, discount, final: Math.max(0, price - discount) };
}
