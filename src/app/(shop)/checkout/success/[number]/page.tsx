import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { notFound } from 'next/navigation';
import { get } from '@/lib/db';
import { fa, PAY_METHOD, toman } from '@/lib/format';
import ClearCart from '@/components/shop/ClearCart';

export const metadata: Metadata = { title: 'ثبت سفارش', robots: { index: false } };

export default async function SuccessPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ failed?: string }> }) {
  const { number } = await params;
  const failed = (await searchParams).failed === '1';
  const o = get<{ number: string; total: number; payment_method: string; payment_status: string }>('SELECT number, total, payment_method, payment_status FROM orders WHERE number = ?', number);
  if (!o) notFound();
  return (
    <div className="wrap">
      <ClearCart />
      <div className="success">
        <div className="tick" style={failed ? { background: 'var(--sale-soft)', color: 'var(--sale)' } : undefined}>{failed ? <X /> : <Check />}</div>
        <h1 style={{ fontSize: 28 }}>{failed ? 'پرداخت انجام نشد' : 'سفارش شما ثبت شد'}</h1>
        <p className="mute">
          {failed ? <>سفارش شما ثبت شده، اما پرداخت ناموفق بود. می‌توانید با پشتیبانی تماس بگیرید.</> : <>شماره سفارش: <b className="num" style={{ color: 'var(--ink)' }}>{fa(o.number)}</b>. کارشناسان ما به‌زودی برای تأیید با شما تماس می‌گیرند.</>}
        </p>
        <div className="card-box" style={{ width: '100%', textAlign: 'start' }}>
          <div className="sum" style={{ border: 0, padding: 0 }}>
            <div className="row"><span>مبلغ سفارش</span><b className="num">{toman(o.total)} تومان</b></div>
            <div className="row"><span>روش پرداخت</span><span>{PAY_METHOD[o.payment_method]}</span></div>
            <div className="row"><span>وضعیت پرداخت</span><span>{o.payment_status === 'paid' ? 'پرداخت‌شده' : o.payment_method === 'cod' ? 'پرداخت در محل' : 'پرداخت‌نشده'}</span></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link className="btn btn-primary btn-lg" href="/shop">ادامه‌ی خرید</Link>
          <Link className="btn btn-secondary btn-lg" href="/account">سفارش‌های من</Link>
        </div>
      </div>
    </div>
  );
}
