import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Phone } from 'lucide-react';
import { all, get } from '@/lib/db';
import { fa, faDigits, jdatetime, ORDER_STATUS, PAY_STATUS, toman } from '@/lib/format';
import { parseReceipt, payLabels } from '@/lib/payment-methods';
import { Card, Note, PageHead, Pill } from '@/components/admin/ui';
import { ActionForm, PrintButton } from '@/components/admin/client';
import { updateOrder } from '@/lib/actions/admin-sales';
import Pic from '@/components/shop/Pic';
import { getSettings } from '@/lib/catalog';

export const metadata: Metadata = { title: 'جزئیات سفارش' };

type O = { id: number; number: string; user_id: number | null; customer_name: string; phone: string; email: string | null; province: string; city: string; address: string; postal_code: string; note: string; status: string; payment_method: string; payment_status: string; subtotal: number; discount: number; shipping: number; total: number; coupon_code: string | null; tracking_code: string; admin_note: string; created_at: string };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const o = get<O>('SELECT * FROM orders WHERE id = ?', id);
  if (!o) notFound();
  const items = all<{ id: number; product_id: number | null; name: string; variation_label: string; sku: string | null; price: number; qty: number; image: string | null }>('SELECT * FROM order_items WHERE order_id = ?', id);
  const labels = payLabels();
  const pays = all<{ id: number; method: string; amount: number; status: string; ref: string | null; meta: string | null; created_at: string }>('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC', id);
  const s = getSettings();
  const steps = ['pending', 'processing', 'shipped', 'delivered'];
  const idx = steps.indexOf(o.status);
  const lost = ['cancelled', 'returned'].includes(o.status);

  return (
    <>
      <PageHead title={`سفارش ${fa(o.number)}`} crumbs={[{ label: 'سفارش‌ها', href: '/admin/orders' }, { label: fa(o.number) }]} desc={`ثبت‌شده در ${jdatetime(o.created_at)}`}>
        <PrintButton label="چاپ فاکتور" />
        <Pill tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Pill>
      </PageHead>
      <div className="ad-cols">
        <div className="ad-stack">
          <Card title={`اقلام سفارش (${fa(items.reduce((a, i) => a + i.qty, 0))})`} tight>
            <div className="ad-tablewrap"><table className="ad-table">
              <thead><tr><th>محصول</th><th className="num-col">قیمت واحد</th><th className="num-col">تعداد</th><th className="num-col">جمع</th></tr></thead>
              <tbody>{items.map((i) => (
                <tr key={i.id}>
                  <td><div className="pn"><span className="thumb"><Pic src={i.image} /></span><span><b>{i.product_id ? <Link className="link" href={`/admin/products/${i.product_id}`}>{i.name}</Link> : i.name}</b>{i.variation_label && <small dir="auto">{i.variation_label}</small>}{i.sku && <small dir="ltr" style={{ display: 'block', textAlign: 'right' }}>{i.sku}</small>}</span></div></td>
                  <td className="num-col">{toman(i.price)}</td><td className="num-col">{fa(i.qty)}</td><td className="num-col"><b>{toman(i.price * i.qty)}</b></td>
                </tr>))}</tbody>
              <tfoot>
                <tr><td colSpan={3} className="num-col mute">جمع کالاها</td><td className="num-col">{toman(o.subtotal)}</td></tr>
                {o.discount > 0 && <tr><td colSpan={3} className="num-col mute">تخفیف{o.coupon_code ? ` (${o.coupon_code})` : ''}</td><td className="num-col" style={{ color: 'var(--sale)' }}>−{toman(o.discount)}</td></tr>}
                <tr><td colSpan={3} className="num-col mute">هزینه‌ی ارسال</td><td className="num-col">{o.shipping ? toman(o.shipping) : 'رایگان'}</td></tr>
                <tr><td colSpan={3} className="num-col"><b>مبلغ نهایی (تومان)</b></td><td className="num-col"><b style={{ fontSize: 16 }}>{toman(o.total)}</b></td></tr>
              </tfoot>
            </table></div>
          </Card>
          <Card title="اطلاعات مشتری و تحویل">
            <div className="ad-grid2">
              <div><span className="mute">نام</span><br /><b>{o.customer_name}</b></div>
              <div><span className="mute">موبایل</span><br /><a className="link num" href={`tel:${o.phone}`}><Phone style={{ width: 14, display: 'inline', verticalAlign: '-2px' }} /> {o.phone}</a></div>
              <div><span className="mute">استان و شهر</span><br />{[o.province, o.city].filter(Boolean).join('، ') || '—'}</div>
              <div><span className="mute">کد پستی</span><br /><span className="num">{o.postal_code || '—'}</span></div>
            </div>
            <div><span className="mute">نشانی</span><br />{o.address}</div>
            {o.note && <Note><b>توضیح مشتری:</b> {o.note}</Note>}
            {o.user_id && <Link className="link" href={`/admin/users?q=${encodeURIComponent(o.phone)}`}>مشاهده‌ی حساب مشتری</Link>}
          </Card>
          <Card title="پرداخت‌ها" tight>
            {pays.map((p) => (
              <div className="list-rows row" key={p.id} style={{ display: 'flex' }}>
                <span className="t"><b>{labels[p.method] ?? p.method}</b><small>{jdatetime(p.created_at)}{p.ref ? ` · کد پیگیری ${p.ref}` : ''}<ReceiptLine meta={p.meta} /></small></span>
                <span className="num">{toman(p.amount)} تومان</span>
                <Pill tone={p.status === 'success' ? 'success' : p.status === 'failed' ? 'danger' : p.status === 'refunded' ? 'muted' : 'warning'}>{{ success: 'موفق', failed: 'ناموفق', refunded: 'بازگشت', pending: 'در انتظار' }[p.status]}</Pill>
              </div>
            ))}
          </Card>
        </div>
        <div className="ad-stack no-print">
          <Card title="پیگیری سفارش">
            {!lost ? (
              <div className="timeline" aria-label="مراحل سفارش">
                {[['pending', 'ثبت و در انتظار تأیید'], ['processing', 'در حال آماده‌سازی'], ['shipped', 'ارسال شد'], ['delivered', 'تحویل شد']].map(([k, label], i) => (
                  <div key={k} className={`st${i < idx ? ' done' : ''}${i === idx ? ' now' : ''}`}><i /><div><b>{label}</b></div></div>
                ))}
              </div>
            ) : <Pill tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Pill>}
          </Card>
          <Card title="مدیریت سفارش">
            <ActionForm action={updateOrder.bind(null, id)} className="form status-form">
              <div className="fld"><label htmlFor="st">وضعیت سفارش</label>
                <select id="st" className="sel" name="status" defaultValue={o.status}>{Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                <span className="help">لغو یا مرجوع کردن، موجودی کالاها را به انبار برمی‌گرداند.</span></div>
              <div className="fld"><label htmlFor="ps">وضعیت پرداخت</label>
                <select id="ps" className="sel" name="payment_status" defaultValue={o.payment_status}>{Object.entries(PAY_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
              <div className="fld"><label htmlFor="tr">کد رهگیری پستی</label><input id="tr" className="input" name="tracking_code" dir="ltr" defaultValue={o.tracking_code} /></div>
              <div className="fld"><label htmlFor="an">یادداشت داخلی</label><textarea id="an" className="textarea" name="admin_note" defaultValue={o.admin_note} /><span className="help">فقط برای مدیران قابل مشاهده است.</span></div>
            </ActionForm>
          </Card>
        </div>
      </div>
      <p className="mute no-print" style={{ marginTop: 16, fontSize: 12.5 }}>فاکتور چاپی با نام {s.store_name} آماده است (دکمه‌ی «چاپ فاکتور»).</p>
    </>
  );
}

function ReceiptLine({ meta }: { meta: string | null }) {
  const r = parseReceipt(meta);
  if (!r) return null;
  return (
    <>
      {r.last4 ? ` · کارت …${faDigits(r.last4)}` : ''}{r.note ? ` · ${r.note}` : ''}
      {r.image && <> · <a className="link" href={`/admin/receipts/${r.image}`} target="_blank" rel="noopener">مشاهده‌ی رسید</a></>}
    </>
  );
}
