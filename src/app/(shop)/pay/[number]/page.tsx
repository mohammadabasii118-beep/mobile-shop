import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { CreditCard } from 'lucide-react';
import { get } from '@/lib/db';
import { fa, toman } from '@/lib/format';
import { finishPayment } from '@/lib/actions/shop';
import { onlineGatewayEnabled } from '@/lib/payments';
import { DRIVERS } from '@/lib/payment-drivers';
import { getMethod, orderPayCode } from '@/lib/payment-methods';
import { CopyButton, ReceiptForm } from '@/components/shop/CardPay';

export const metadata: Metadata = { title: 'پرداخت سفارش', robots: { index: false } };

/** درگاه پرداخت آزمایشی. برای فروش واقعی با درگاه بانکی (زرین‌پال، ...) جایگزین شود. */
export default async function PayPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const o = get<{ number: string; total: number; payment_method: string; pay_code: string | null; payment_status: string }>('SELECT number, total, payment_method, pay_code, payment_status FROM orders WHERE number = ?', number);
  if (!o) notFound();
  if (o.payment_method !== 'online' || o.payment_status === 'paid') redirect(`/checkout/success/${number}`);
  const m = getMethod(orderPayCode(o)) ?? getMethod('test');
  const kind = m ? DRIVERS[m.driver]?.kind : null;
  if (m && kind === 'manual') return <ManualPay number={o.number} total={o.total} m={m} />;
  if (m?.driver !== 'test' || !onlineGatewayEnabled()) notFound();
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

function ManualPay({ number, total, m }: { number: string; total: number; m: NonNullable<ReturnType<typeof getMethod>> }) {
  const digits = (m.cfg.card_number ?? '').replace(/\D/g, '');
  const grouped = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  return (
    <div className="wrap">
      <div className="success" style={{ maxWidth: 560 }}>
        <div className="tick" style={{ background: 'var(--action-soft)', color: 'var(--action)' }}><CreditCard /></div>
        <h1 style={{ fontSize: 26 }}>{m.title}</h1>
        <p className="mute">سفارش <b className="num">{fa(number)}</b> ثبت شد. مبلغ زیر را واریز و سپس اطلاعات واریز را ثبت کنید.</p>
        <div className="card-box pay-card" style={{ width: '100%', textAlign: 'start' }}>
          <div className="row"><span>مبلغ قابل واریز</span><b className="num">{toman(total)} تومان</b></div>
          <div className="row"><span>شماره کارت</span><b className="cardnum" dir="ltr">{grouped}</b></div>
          {m.cfg.owner && <div className="row"><span>به نام</span><b>{m.cfg.owner}</b></div>}
          {m.cfg.bank && <div className="row"><span>بانک</span><b>{m.cfg.bank}</b></div>}
          {m.cfg.sheba && <div className="row"><span>شبا</span><b dir="ltr">{m.cfg.sheba}</b></div>}
          <div className="copy-row"><CopyButton value={digits} label="کپی شماره کارت" /><CopyButton value={String(total)} label="کپی مبلغ" /></div>
          {m.cfg.instructions && <p className="mute" style={{ fontSize: 13.5, whiteSpace: 'pre-line' }}>{m.cfg.instructions}</p>}
        </div>
        <ReceiptForm number={number} />
      </div>
    </div>
  );
}
