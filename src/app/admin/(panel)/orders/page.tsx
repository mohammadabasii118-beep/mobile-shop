import type { Metadata } from 'next';
import Link from 'next/link';
import { Download, Search } from 'lucide-react';
import { all, get } from '@/lib/db';
import { fa, jdatetime, normText, ORDER_STATUS, PAY_STATUS, toman } from '@/lib/format';
import { orderPayCode, payLabels } from '@/lib/payment-methods';
import { Card, EmptyState, PageHead, Pagination, Pill, qsLink, one } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'سفارش‌ها' };
const PER = 20;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const status = one(sp.status), q = normText(one(sp.q)), pay = one(sp.pay);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const where: string[] = []; const args: unknown[] = [];
  if (status && ORDER_STATUS[status]) { where.push('status = ?'); args.push(status); }
  if (pay && PAY_STATUS[pay]) { where.push('payment_status = ?'); args.push(pay); }
  if (q) { where.push('(number LIKE ? OR customer_name LIKE ? OR phone LIKE ?)'); const l = `%${q}%`; args.push(l, l, l); }
  const W = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = get<{ n: number }>(`SELECT COUNT(*) n FROM orders ${W}`, ...args)!.n;
  const rows = all<{ id: number; number: string; customer_name: string; phone: string; status: string; payment_status: string; payment_method: string; pay_code: string | null; total: number; created_at: string; items: number }>(
    `SELECT o.*, (SELECT COALESCE(SUM(qty),0) FROM order_items i WHERE i.order_id = o.id) items FROM orders o ${W} ORDER BY id DESC LIMIT ? OFFSET ?`, ...args, PER, (page - 1) * PER);
  const labels = payLabels();
  const counts = Object.fromEntries(all<{ status: string; n: number }>('SELECT status, COUNT(*) n FROM orders GROUP BY status').map((r) => [r.status, r.n]));
  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);
  const href = (p: number) => qsLink('/admin/orders', sp, { page: String(p) });
  return (
    <>
      <PageHead title="سفارش‌ها" desc="سفارش‌های مشتری‌ها؛ برای دیدن جزئیات، تغییر وضعیت و ثبت کد پیگیری روی شماره‌ی سفارش بزنید.">
        <a className="btn btn-secondary" href="/admin/export/orders"><Download />خروجی اکسل (CSV)</a>
      </PageHead>
      <Card tight>
        <nav className="ad-tabs" aria-label="وضعیت سفارش">
          <Link href="/admin/orders" aria-current={!status ? 'page' : undefined}>همه <span className="c num">{fa(totalAll)}</span></Link>
          {Object.entries(ORDER_STATUS).map(([k, v]) => <Link key={k} href={`/admin/orders?status=${k}`} aria-current={status === k ? 'page' : undefined}>{v.label} <span className="c num">{fa(counts[k] ?? 0)}</span></Link>)}
        </nav>
        <div className="ad-toolbar">
          <form method="get" action="/admin/orders">
            {status && <input type="hidden" name="status" value={status} />}
            <label className="ad-search grow"><Search className="i" style={{ width: 18 }} /><input name="q" defaultValue={q} placeholder="شماره سفارش، نام یا موبایل مشتری…" aria-label="جستجوی سفارش" /></label>
            <select className="sel" name="pay" defaultValue={pay} style={{ width: 'auto' }} aria-label="وضعیت پرداخت"><option value="">همه‌ی پرداخت‌ها</option>{Object.entries(PAY_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
            <button className="btn btn-secondary">جستجو</button>
          </form>
        </div>
        {rows.length === 0 ? <EmptyState title="سفارشی پیدا نشد" /> : (
          <div className="ad-tablewrap"><table className="ad-table cards">
            <thead><tr><th>سفارش</th><th>مشتری</th><th>زمان</th><th className="num-col">اقلام</th><th>پرداخت</th><th>وضعیت</th><th className="num-col">مبلغ</th></tr></thead>
            <tbody>{rows.map((o) => (
              <tr key={o.id}>
                <td data-label="سفارش"><Link className="link num" href={`/admin/orders/${o.id}`}>{fa(o.number)}</Link></td>
                <td data-label="مشتری"><b style={{ color: 'var(--ink)' }}>{o.customer_name}</b><small className="mute num" style={{ display: 'block' }}>{o.phone}</small></td>
                <td data-label="زمان" className="mute">{jdatetime(o.created_at)}</td>
                <td data-label="اقلام" className="num-col">{fa(o.items)}</td>
                <td data-label="پرداخت"><Pill tone={PAY_STATUS[o.payment_status].tone}>{PAY_STATUS[o.payment_status].label}</Pill><small className="mute" style={{ display: 'block' }}>{labels[orderPayCode(o)] ?? orderPayCode(o)}</small></td>
                <td data-label="وضعیت"><Pill tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Pill></td>
                <td data-label="مبلغ" className="num-col"><b>{toman(o.total)}</b> <small className="mute">تومان</small></td>
              </tr>))}</tbody>
          </table></div>
        )}
        <Pagination page={page} pages={Math.max(1, Math.ceil(total / PER))} total={total} hrefFor={href} per={PER} />
      </Card>
    </>
  );
}
