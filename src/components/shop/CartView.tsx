'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Tag, Trash2, TriangleAlert } from 'lucide-react';
import { getCartLines } from '@/lib/actions/shop';
import { fa, toman } from '@/lib/format';
import type { CartLine } from '@/lib/types';
import Pic from './Pic';
import { useShop } from './CartProvider';

export type CartData = Awaited<ReturnType<typeof getCartLines>>;

/** هوک مشترک سبد و تسویه: قیمت‌های واقعی از سرور */
export function useCartData() {
  const { items, ready } = useShop();
  const [coupon, setCoupon] = useState('');
  const [data, setData] = useState<CartData | null>(null);
  const [loading, start] = useTransition();
  useEffect(() => { try { setCoupon(sessionStorage.getItem('vt_coupon') || ''); } catch { /* noop */ } }, []);
  const key = JSON.stringify(items) + '|' + coupon;
  useEffect(() => {
    if (!ready) return;
    start(async () => setData(await getCartLines(items, coupon)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);
  const apply = (c: string) => { setCoupon(c); try { sessionStorage.setItem('vt_coupon', c); } catch { /* noop */ } };
  return { items, ready, data, loading, coupon, apply };
}

export function Summary({ data, cta }: { data: CartData; cta?: React.ReactNode }) {
  const left = Math.max(0, data.freeMin - (data.subtotal - data.discount));
  const progress = data.freeMin > 0 ? Math.min(100, ((data.subtotal - data.discount) / data.freeMin) * 100) : 100;
  return (
    <>
      {data.freeMin > 0 && data.subtotal > 0 && (
        <div>
          <p style={{ fontSize: 13, marginBottom: 6 }}>{left > 0 ? <><b className="num">{toman(left)}</b> تومان تا ارسال رایگان</> : 'ارسال سفارش شما رایگان است'}</p>
          <div className="ship-bar"><i style={{ width: `${progress}%` }} /></div>
        </div>
      )}
      <div className="row"><span>جمع کالاها</span><span className="num">{toman(data.subtotal)} تومان</span></div>
      {data.discount > 0 && <div className="row disc"><span>تخفیف{data.couponCode ? ` (${data.couponCode})` : ''}</span><span className="num">−{toman(data.discount)} تومان</span></div>}
      <div className="row"><span>هزینه‌ی ارسال</span><span className="num">{data.shipping ? `${toman(data.shipping)} تومان` : 'رایگان'}</span></div>
      <div className="row total"><span>مبلغ قابل پرداخت</span><span className="num">{toman(data.total)} تومان</span></div>
      {cta}
    </>
  );
}

export function CouponBox({ coupon, apply, data }: { coupon: string; apply: (c: string) => void; data: CartData | null }) {
  const [v, setV] = useState('');
  useEffect(() => setV(coupon), [coupon]);
  return (
    <div>
      <form className="coupon" onSubmit={(e) => { e.preventDefault(); apply(v.trim()); }}>
        <input className="input" value={v} onChange={(e) => setV(e.target.value)} placeholder="کد تخفیف" aria-label="کد تخفیف" />
        <button className="btn btn-secondary" type="submit"><Tag className="i" style={{ width: 16 }} />اعمال</button>
      </form>
      {data?.couponError && coupon && <p className="error" style={{ fontSize: 13, color: 'var(--sale)', marginTop: 6 }}>{data.couponError}</p>}
      {data?.couponCode && <p style={{ fontSize: 13, color: 'var(--success)', marginTop: 6 }}>کد «{data.couponCode}» اعمال شد.</p>}
    </div>
  );
}

function Line({ l }: { l: CartLine }) {
  const { setQty, remove } = useShop();
  return (
    <div className="line">
      <Link className="th" href={l.slug ? `/product/${encodeURIComponent(l.slug)}` : '#'}>{l.image ? <Pic src={l.color && l.image.startsWith('art:p-case') && !l.image.includes('@') ? `${l.image}@${l.color}` : l.image} alt={l.name} /> : <Pic src={null} />}</Link>
      <div>
        <h3>{l.slug ? <Link href={`/product/${encodeURIComponent(l.slug)}`}>{l.name}</Link> : l.name}</h3>
        {l.label && <div className="var">{l.label}</div>}
        {l.issue && <div className="issue"><TriangleAlert className="i" style={{ width: 14, display: 'inline', verticalAlign: '-2px' }} /> {l.issue}</div>}
        <div className="bot">
          {l.ok ? (
            <div className="stepper sm" role="group" aria-label="تعداد">
              <button onClick={() => setQty(l.productId, l.variationId, l.qty - 1)} disabled={l.qty <= 1} aria-label="کاهش تعداد"><Minus className="i" style={{ width: 16 }} /></button>
              <output className="num">{fa(l.qty)}</output>
              <button onClick={() => setQty(l.productId, l.variationId, l.qty + 1)} disabled={l.qty >= l.stock} aria-label="افزایش تعداد"><Plus className="i" style={{ width: 16 }} /></button>
            </div>
          ) : <span />}
          <div className="lp num">
            {l.ok ? <>{l.old && <s>{toman(l.old * l.qty)}</s>}{toman(l.price * l.qty)} <small className="mute" style={{ fontWeight: 400 }}>تومان</small></> : null}
          </div>
        </div>
        <button className="rm" style={{ marginTop: 8 }} onClick={() => remove(l.productId, l.variationId)}><Trash2 className="i" style={{ width: 14 }} />حذف</button>
      </div>
    </div>
  );
}

export function EmptyCart() {
  return (
    <div className="empty">
      <ShoppingBag className="big" />
      <h2>سبد خرید شما خالی است</h2>
      <p>محصولات مورد علاقه‌تان را به سبد اضافه کنید.</p>
      <Link className="btn btn-primary btn-lg" href="/shop">مشاهده‌ی فروشگاه</Link>
    </div>
  );
}

export default function CartView() {
  const { items, ready, data, loading, coupon, apply } = useCartData();
  if (!ready) return <div className="two-col"><div className="sk" style={{ height: 240 }} /><div className="sk" style={{ height: 280 }} /></div>;
  if (items.length === 0) return <EmptyCart />;
  const blocked = !data || data.lines.some((l) => !l.ok);
  return (
    <div className="two-col" style={{ opacity: loading ? 0.7 : 1, transition: 'opacity .2s' }}>
      <div className="lines" aria-live="polite">
        {data?.lines.map((l) => <Line key={l.key} l={l} />) ?? <div className="sk" style={{ height: 200 }} />}
      </div>
      <aside className="sum">
        <h2>خلاصه‌ی سفارش</h2>
        <CouponBox coupon={coupon} apply={apply} data={data} />
        {data && <Summary data={data} cta={blocked ? <p className="issue" style={{ color: 'var(--sale)', fontSize: 13 }}>کالاهای ناموجود را حذف کنید تا بتوانید ادامه دهید.</p> : null} />}
        <Link className={`btn btn-buy btn-lg btn-block${blocked ? ' disabled' : ''}`} href="/checkout" aria-disabled={blocked} onClick={(e) => blocked && e.preventDefault()} style={blocked ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>ادامه‌ی خرید</Link>
      </aside>
    </div>
  );
}
