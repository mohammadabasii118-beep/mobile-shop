import type { CartLine, Product } from '@/types';

export const FREE_SHIPPING_THRESHOLD = 350_000; // ۳۵۰ هزار تومان
export const SHIPPING_FEE = 45_000;

type Line = { product: Product; quantity: number };

export const calculateSubtotal = (lines: Line[]): number =>
  lines.reduce((s, l) => s + (l.product.oldPrice ?? l.product.price) * l.quantity, 0);

/** مجموع تخفیف: تفاوت قیمت قبل و جاری + کد تخفیف */
export const calculateDiscount = (lines: Line[], couponPercent = 0): number => {
  const base = lines.reduce((s, l) => s + (l.product.oldPrice ?? l.product.price) * l.quantity, 0);
  const current = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
  return base - current + Math.round((current * couponPercent) / 100);
};

export const calculateShipping = (payable: number, method: 'standard' | 'express' | 'free' = 'standard'): number => {
  if (payable === 0) return 0;
  if (method === 'express') return 95_000;
  return payable >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
};

export const calculateTotal = (lines: Line[], couponPercent = 0, method: 'standard' | 'express' = 'standard'): number => {
  const sub = calculateSubtotal(lines);
  const disc = calculateDiscount(lines, couponPercent);
  const payable = sub - disc;
  return payable + calculateShipping(payable, method);
};

export const toLines = (cart: CartLine[], products: Product[]): Line[] =>
  cart.flatMap((c) => {
    const p = products.find((x) => x.id === c.productId);
    return p ? [{ product: p, quantity: c.quantity }] : [];
  });
