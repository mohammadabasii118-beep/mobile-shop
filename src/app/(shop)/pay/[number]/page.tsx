import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { CreditCard } from 'lucide-react';
import { get } from '@/lib/db';
import { fa, toman } from '@/lib/format';
import { finishPayment } from '@/lib/actions/shop';
import { onlineGatewayEnabled } from '@/lib/payments';

export const metadata: Metadata = { title: 'پرداخت آنلاین', robots: { index: false } };

/** درگاه پرداخت آزمایشی. برای فروش واقعی با درگاه بانکی (زرین‌پال، ...) جایگزین شود. */
export default async function PayPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  if (!onlineGatewayEnabled()) notFound();
  const o = get<{ number: string; total: number; payment_method: string; payment_status: string }>('SELECT number, total, payment_method, payment_status FROM orders WHERE number = ?', number);
  if (!o) notFound();
  if (o.payment_method !== 'online' || o.payment_status === 'paid') redirect(`/checkout/success/${number}`);
  return (
    <div className="wrap">
      <div className="success">
        <div className="tick" style={{ background: 'var(--action-soft)', color: 'var(--action)' }}><CreditCard /></div>
        <h1 style={{ fontSize: 26 }}>درگاه پرداخت آزمایشی</h1>
        <p className="mute">سفارش <b className="num">{fa(o.number)}</b> · مبلغ <b className="num">{toman(o.total)}</b> تومان</p>
        <div className="alert info" style={{ textAlign: 'start' }}>این صفحه شبیه‌ساز درگاه است و پولی کسر نمی‌شود. پس از اتصال درگاه واقعی، مشتری به صفحه‌ی بانک هدایت می‌شود.</div>
        <form style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-buy btn-lg" formAction={finishPayment.bind(null, number, true)}>پرداخت موفق</button>
          <button className="btn btn-secondary btn-lg" formAction={finishPayment.bind(null, number, false)}>انصراف / پرداخت ناموفق</button>
        </form>
      </div>
    </div>
  );
}
