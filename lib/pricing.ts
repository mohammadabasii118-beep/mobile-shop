import type { CartLine } from "@/types/product";
import { materials, patterns, phones, type MaterialId, type PatternId, type PhoneId } from "@/data/configurator";

export const FREE_SHIPPING_THRESHOLD = 2_000_000;
export const SHIPPING_FEE = 120_000;
export const COUPONS: Record<string, { label: string; percent: number }> = {
  VOLTA10: { label: "۱۰٪ تخفیف اولین خرید", percent: 10 },
};

export function discountPercent(price: number, oldPrice?: number) {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

export function configuratorPrice(phone: PhoneId, material: MaterialId, pattern: PatternId) {
  const p = phones.find((x) => x.id === phone)!;
  const m = materials.find((x) => x.id === material)!;
  const t = patterns.find((x) => x.id === pattern)!;
  return p.basePrice + m.surcharge + t.surcharge;
}

export function cartTotals(lines: CartLine[], couponCode?: string | null) {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const listTotal = lines.reduce((s, l) => s + (l.oldPrice ?? l.unitPrice) * l.qty, 0);
  const saved = listTotal - subtotal;
  const coupon = couponCode ? COUPONS[couponCode] : undefined;
  const couponDiscount = coupon ? Math.round((subtotal * coupon.percent) / 100) : 0;
  const afterDiscount = subtotal - couponDiscount;
  const shipping = lines.length === 0 || afterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  return {
    count: lines.reduce((s, l) => s + l.qty, 0),
    subtotal,
    saved,
    couponDiscount,
    shipping,
    total: afterDiscount + shipping,
    freeShippingRemaining: Math.max(0, FREE_SHIPPING_THRESHOLD - afterDiscount),
  };
}
