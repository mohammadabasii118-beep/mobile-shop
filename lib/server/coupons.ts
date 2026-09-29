import type { Prisma } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/server/errors";

type Db = Prisma.TransactionClient | typeof db;

export interface CouponResult { couponId: string; code: string; discount: number }

/**
 * Validates a coupon against the current server-side subtotal. Coupons apply to retail-priced
 * lines only (wholesale prices are already discounted).
 */
export async function evaluateCoupon(client: Db, rawCode: string, opts: { userId: string; retailSubtotal: number }): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  const c = await client.coupon.findUnique({ where: { code } });
  const now = new Date();
  if (!c || !c.isActive) throw badRequest("کد تخفیف معتبر نیست.", "coupon_invalid");
  if (c.startsAt && c.startsAt > now) throw badRequest("این کد تخفیف هنوز فعال نشده است.", "coupon_not_started");
  if (c.endsAt && c.endsAt < now) throw badRequest("مهلت استفاده از این کد تخفیف تمام شده است.", "coupon_expired");
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) throw badRequest("ظرفیت استفاده از این کد تخفیف تمام شده است.", "coupon_exhausted");
  if (opts.retailSubtotal <= 0) throw badRequest("این کد فقط برای کالاهای با قیمت عادی قابل استفاده است.", "coupon_not_applicable");
  if (opts.retailSubtotal < c.minOrder) throw badRequest(`حداقل مبلغ خرید برای این کد ${c.minOrder.toLocaleString("fa-IR")} تومان است.`, "coupon_min_order");
  if (c.perUserLimit != null) {
    const used = await client.couponUsage.count({ where: { couponId: c.id, userId: opts.userId } });
    if (used >= c.perUserLimit) throw badRequest("شما قبلاً از این کد تخفیف استفاده کرده‌اید.", "coupon_user_limit");
  }
  let discount = c.type === "percent" ? Math.floor((opts.retailSubtotal * c.value) / 100) : c.value;
  if (c.maxDiscount != null) discount = Math.min(discount, c.maxDiscount);
  discount = Math.max(0, Math.min(discount, opts.retailSubtotal));
  return { couponId: c.id, code: c.code, discount };
}
