import { useState } from 'react';
import { products } from '@/data/products';
import { useShop } from '@/store';
import { FREE_SHIPPING_THRESHOLD, calculateDiscount, calculateShipping, calculateSubtotal, toLines } from '@/utils/pricing';
import { formatPrice } from '@/utils/format';

export function useCartTotals(method: 'standard' | 'express' = 'standard') {
  const cart = useShop((s) => s.cart);
  const coupon = useShop((s) => s.coupon);
  const lines = toLines(cart, products);
  const subtotal = calculateSubtotal(lines);
  const discount = calculateDiscount(lines, coupon?.percent ?? 0);
  const payable = subtotal - discount;
  const shipping = calculateShipping(payable, method);
  return { lines, subtotal, discount, payable, shipping, total: payable + shipping, count: cart.reduce((s, l) => s + l.quantity, 0) };
}

export function FreeShippingBar({ payable }: { payable: number }) {
  const left = Math.max(0, FREE_SHIPPING_THRESHOLD - payable);
  const pct = Math.min(100, (payable / FREE_SHIPPING_THRESHOLD) * 100);
  return (
    <div className="rounded-2xl border border-line bg-surface2/50 p-4">
      <p className="mb-2 text-xs font-bold text-white">{left > 0 ? `${formatPrice(left)} تا ارسال رایگان` : '🎉 ارسال این سفارش رایگان است'}</p>
      <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-brand-gradient transition-all duration-700" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function TotalsTable({ t, withCoupon }: { t: ReturnType<typeof useCartTotals>; withCoupon?: boolean }) {
  const applyCoupon = useShop((s) => s.applyCoupon);
  const coupon = useShop((s) => s.coupon);
  const [code, setCode] = useState('');
  return (
    <div className="space-y-3 text-sm">
      {withCoupon && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); applyCoupon(code); }}>
          <input className="input" placeholder={coupon ? coupon.code : 'کد تخفیف (مثلاً WELCOME10)'} value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn btn-ghost !px-4">ثبت</button>
        </form>
      )}
      <Row k="جمع محصولات" v={formatPrice(t.subtotal)} />
      <Row k="تخفیف" v={t.discount ? `− ${formatPrice(t.discount)}` : '—'} accent />
      <Row k="هزینه ارسال" v={t.shipping ? formatPrice(t.shipping) : 'رایگان'} />
      <div className="border-t border-line pt-3"><Row k="مبلغ نهایی" v={formatPrice(t.total)} strong /></div>
    </div>
  );
}
const Row = ({ k, v, strong, accent }: { k: string; v: string; strong?: boolean; accent?: boolean }) => (
  <div className={`flex justify-between ${strong ? 'text-lg font-black text-white' : accent ? 'text-magenta' : 'text-mist/80'}`}><span>{k}</span><span>{v}</span></div>
);
