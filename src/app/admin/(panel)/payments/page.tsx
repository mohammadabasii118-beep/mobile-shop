import type { Metadata } from 'next';
import Link from 'next/link';
import { Paperclip } from 'lucide-react';
import { all, get } from '@/lib/db';
import { fa, faDigits, jdatetime, toman } from '@/lib/format';
import { listMethods, parseReceipt, payLabels } from '@/lib/payment-methods';
import { Card, EmptyState, Kpi, PageHead, Pagination, Pill, qsLink, one } from '@/components/admin/ui';
import { QuickAction } from '@/components/admin/client';
import { setPaymentStatus } from '@/lib/actions/admin-sales';

export const metadata: Metadata = { title: 'پرداخت‌ها' };
const PER = 25;
const LABEL: Record<string, [string, string]> = { success: ['موفق', 'success'], failed: ['ناموفق', 'danger'], pending: ['در انتظار', 'warning'], refunded: ['بازگشت وجه', 'muted'] };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const status = one(sp.status), method = one(sp.method);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const where: string[] = []; const args: unknown[] = [];
  if (LABEL[status]) { where.push('p.status = ?'); args.push(status); }
  const methods = listMethods();
  if (methods.some((m) => m.code === method)) { where.push('p.method = ?'); args.push(method); }
  const labels = payLabels();
  const W = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = get<{ n: number }>(`SELECT COUNT(*) n FROM payments p ${W}`, ...args)!.n;
  const rows = all<{ id: number; order_id: number; number: string; customer_name: string; method: string; amount: number; status: string; ref: string | null; meta: string | null; created_at: string }>(
    `SELECT p.*, o.number, o.customer_name FROM payments p JOIN orders o ON o.id = p.order_id ${W} ORDER BY p.id DESC LIMIT ? OFFSET ?`, ...args, PER, (page - 1) * PER);
  const sum = (st: string) => get<{ s: number; n: number }>('SELECT COALESCE(SUM(amount),0) s, COUNT(*) n FROM payments WHERE status = ?', st)!;
  const ok = sum('success'), pend = sum('pending'), fail = sum('failed');
  const href = (p: number) => qsLink('/admin/payments', sp, { page: String(p) });
  return (
    <>
      <PageHead title="پرداخت‌ها" desc="تراکنش‌های همه‌ی سفارش‌ها. پرداخت در محل پس از دریافت وجه، دستی «موفق» ثبت می‌شود." />
      <div className="ad-kpis">
        <Kpi label="پرداخت موفق" value={toman(ok.s)} unit="تومان" hint={`${fa(ok.n)} تراکنش`} />
        <Kpi label="در انتظار" value={toman(pend.s)} unit="تومان" hint={`${fa(pend.n)} تراکنش`} />
        <Kpi label="ناموفق" value={fa(fail.n)} unit="تراکنش" />
      </div>
      <Card tight>
        <nav className="ad-tabs" aria-label="روش پرداخت">
          <Link href={qsLink('/admin/payments', sp, { method: null, page: null })} aria-current={!method ? 'page' : undefined}>همه‌ی روش‌ها</Link>
          {methods.map((m) => <Link key={m.code} href={qsLink('/admin/payments', sp, { method: m.code, page: null })} aria-current={method === m.code ? 'page' : undefined}>{m.title}</Link>)}
        </nav>
        <nav className="ad-tabs" aria-label="وضعیت پرداخت">
          <Link href={qsLink('/admin/payments', sp, { status: null, page: null })} aria-current={!status ? 'page' : undefined}>همه</Link>
          {Object.entries(LABEL).map(([k, [l]]) => <Link key={k} href={qsLink('/admin/payments', sp, { status: k, page: null })} aria-current={status === k ? 'page' : undefined}>{l}</Link>)}
        </nav>
        {rows.length === 0 ? <EmptyState title="تراکنشی پیدا نشد" /> : (
          <div className="ad-tablewrap"><table className="ad-table cards">
            <thead><tr><th>سفارش</th><th>مشتری</th><th>روش</th><th>زمان</th><th>کد پیگیری</th><th>وضعیت</th><th className="num-col">مبلغ</th><th /></tr></thead>
            <tbody>{rows.map((r) => { const [l, tone] = LABEL[r.status]; return (
              <tr key={r.id}>
                <td data-label="سفارش"><Link className="link num" href={`/admin/orders/${r.order_id}`}>{fa(r.number)}</Link></td>
                <td data-label="مشتری">{r.customer_name}</td>
                <td data-label="روش">{labels[r.method] ?? r.method}</td>
                <td data-label="زمان" className="mute">{jdatetime(r.created_at)}</td>
                <td data-label="کد پیگیری" className="mute" dir="ltr" style={{ textAlign: 'right' }}>{r.ref ?? '—'}<ReceiptInfo meta={r.meta} /></td>
                <td data-label="وضعیت"><Pill tone={tone}>{l}</Pill></td>
                <td data-label="مبلغ" className="num-col">{toman(r.amount)}</td>
                <td className="full"><div className="actions">
                  {r.status !== 'success' && <QuickAction action={setPaymentStatus.bind(null, r.id, 'success')} className="btn btn-secondary btn-sm">ثبت موفق</QuickAction>}
                  {r.status === 'success' && <QuickAction action={setPaymentStatus.bind(null, r.id, 'refunded')} className="btn btn-secondary btn-sm">بازگشت وجه</QuickAction>}
                  {r.status === 'pending' && <QuickAction action={setPaymentStatus.bind(null, r.id, 'failed')} className="btn btn-secondary btn-sm">ناموفق</QuickAction>}
                </div></td>
              </tr>); })}</tbody>
          </table></div>
        )}
        <Pagination page={page} pages={Math.max(1, Math.ceil(total / PER))} total={total} hrefFor={href} per={PER} />
      </Card>
    </>
  );
}

function ReceiptInfo({ meta }: { meta: string | null }) {
  const r = parseReceipt(meta);
  if (!r) return null;
  const text = [r.last4 && `کارت …${faDigits(r.last4)}`, r.note].filter(Boolean).join(' · ');
  return (
    <small dir="auto" style={{ display: 'block' }}>
      {text}{text && r.image ? ' · ' : ''}
      {r.image && <a className="link" href={`/admin/receipts/${r.image}`} target="_blank" rel="noopener"><Paperclip className="i" style={{ width: 14, verticalAlign: '-2px' }} /> مشاهده‌ی رسید</a>}
    </small>
  );
}
