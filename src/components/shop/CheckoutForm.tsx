'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { submitOrder, type FormState } from '@/lib/actions/shop';
import { toman } from '@/lib/format';
import { CouponBox, EmptyCart, Summary, useCartData } from './CartView';

type Defaults = { name: string; phone: string };

export default function CheckoutForm({ defaults, payCod, payOnline, note }: { defaults: Defaults; payCod: boolean; payOnline: boolean; note: string }) {
  const { items, ready, data, loading, coupon, apply } = useCartData();
  const [state, action, pending] = useActionState<FormState, FormData>(submitOrder, undefined);
  const f = state?.fields ?? {};
  const val = (k: string, d = '') => f[k] ?? d;

  if (!ready) return <div className="sk" style={{ height: 320 }} />;
  if (items.length === 0) return <EmptyCart />;
  const blocked = !data || data.lines.some((l) => !l.ok);

  return (
    <form action={action} className="two-col" noValidate style={{ opacity: loading ? 0.8 : 1 }}>
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="coupon" value={data?.couponCode ?? ''} />
      <div style={{ display: 'grid', gap: 20 }}>
        <section className="card-box" aria-labelledby="h-addr">
          <h2 id="h-addr">اطلاعات تحویل‌گیرنده</h2>
          <div className="grid2">
            <div className="fld"><label htmlFor="name">نام و نام خانوادگی</label><input id="name" className="input" name="name" autoComplete="name" defaultValue={val('name', defaults.name)} required /></div>
            <div className="fld"><label htmlFor="phone">شماره موبایل</label><input id="phone" className="input" name="phone" dir="ltr" inputMode="tel" autoComplete="tel" placeholder="09123456789" defaultValue={val('phone', defaults.phone)} required /></div>
          </div>
          <div className="grid2">
            <div className="fld"><label htmlFor="province">استان</label><input id="province" className="input" name="province" autoComplete="address-level1" defaultValue={val('province', 'تهران')} /></div>
            <div className="fld"><label htmlFor="city">شهر</label><input id="city" className="input" name="city" autoComplete="address-level2" defaultValue={val('city', 'تهران')} /></div>
          </div>
          <div className="fld"><label htmlFor="address">نشانی کامل</label><textarea id="address" className="textarea" name="address" autoComplete="street-address" defaultValue={val('address')} required /></div>
          <div className="grid2">
            <div className="fld"><label htmlFor="postal">کد پستی <small className="mute">(اختیاری)</small></label><input id="postal" className="input" name="postal" dir="ltr" inputMode="numeric" maxLength={10} autoComplete="postal-code" defaultValue={val('postal')} /></div>
            <div className="fld"><label htmlFor="email">ایمیل <small className="mute">(اختیاری)</small></label><input id="email" className="input" name="email" type="email" dir="ltr" autoComplete="email" defaultValue={val('email')} /></div>
          </div>
          <div className="fld"><label htmlFor="note">توضیحات سفارش <small className="mute">(اختیاری)</small></label><textarea id="note" className="textarea" name="note" style={{ minHeight: 72 }} defaultValue={val('note')} /></div>
        </section>

        <section className="card-box" aria-labelledby="h-pay">
          <h2 id="h-pay">روش پرداخت</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {payOnline && <label className="pay-opt"><input type="radio" name="method" value="online" defaultChecked={val('method', 'online') === 'online'} /><div><b>پرداخت آنلاین</b><span>پرداخت امن با کارت‌های عضو شتاب</span></div></label>}
            {payCod && <label className="pay-opt"><input type="radio" name="method" value="cod" defaultChecked={!payOnline || val('method') === 'cod'} /><div><b>پرداخت در محل</b><span>مبلغ را هنگام تحویل بپردازید</span></div></label>}
            {!payCod && !payOnline && <div className="alert err">در حال حاضر هیچ روش پرداختی فعال نیست.</div>}
          </div>
          {note && <p className="mute" style={{ fontSize: 13 }}>{note}</p>}
        </section>
      </div>

      <aside className="sum">
        <h2>خلاصه‌ی سفارش</h2>
        <ul style={{ display: 'grid', gap: 8, fontSize: 13.5 }}>
          {data?.lines.map((l) => (
            <li key={l.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ minWidth: 0 }}>{l.name}{l.label && <small className="mute" dir="auto" style={{ display: 'block' }}>{l.label}</small>}</span>
              <span className="num nowrap">{l.qty.toLocaleString('fa-IR')}×</span>
            </li>
          ))}
        </ul>
        <CouponBox coupon={coupon} apply={apply} data={data} />
        {data && <Summary data={data} />}
        {state?.error && <div className="alert err" role="alert">{state.error}</div>}
        <button className="btn btn-buy btn-lg btn-block" disabled={pending || blocked || (!payCod && !payOnline)}>
          <Lock className="i" style={{ width: 18 }} />{pending ? 'در حال ثبت سفارش…' : data ? `ثبت سفارش و پرداخت ${toman(data.total)} تومان` : 'ثبت سفارش'}
        </button>
        <Link className="link" href="/cart" style={{ textAlign: 'center', fontSize: 14 }}>بازگشت به سبد خرید</Link>
      </aside>
    </form>
  );
}
