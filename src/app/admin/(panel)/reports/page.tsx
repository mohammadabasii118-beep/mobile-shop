import type { Metadata } from 'next';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { all } from '@/lib/db';
import { fa, jshort, ORDER_STATUS, PAY_METHOD, toman } from '@/lib/format';
import { byPaymentMethod, ordersByStatus, pctChange, periodTotals, salesByBrand, salesByCategory, salesByDay, topProducts } from '@/lib/stats';
import { Card, EmptyState, Kpi, PageHead } from '@/components/admin/ui';
import BarChart from '@/components/admin/BarChart';

export const metadata: Metadata = { title: 'گزارش‌ها' };

function Bars({ rows, fmt }: { rows: { name: string; v: number; sub?: string }[]; fmt?: (n: number) => string }) {
  const max = Math.max(...rows.map((r) => r.v), 1);
  if (!rows.length) return <EmptyState title="داده‌ای در این بازه نیست" />;
  return (
    <div className="hbar" style={{ padding: 18 }}>
      {rows.map((r) => (
        <div className="r" key={r.name}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name}</span>
          <span className="tr"><i style={{ width: `${(r.v / max) * 100}%` }} /></span>
          <b className="num">{fmt ? fmt(r.v) : fa(r.v)}</b>
        </div>
      ))}
    </div>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const d = [7, 30, 90].includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 30;
  const cur = periodTotals(-(d - 1), 0), prev = periodTotals(-(2 * d - 1), -d);
  const days = salesByDay(d);
  const top = topProducts(d, 10), cats = salesByCategory(d), brands = salesByBrand(d), st = ordersByStatus(d), pm = byPaymentMethod(d);
  const coupons = all<{ code: string; used: number; type: string; value: number }>('SELECT code, used, type, value FROM coupons WHERE used > 0 ORDER BY used DESC LIMIT 5');
  const delta = (a: number, b: number) => { const c = pctChange(a, b); return c === null ? null : { v: c }; };
  const bars = days.map((x, i) => ({ label: jshort(new Date(x.day + 'T12:00:00Z')), value: x.revenue, title: `${jshort(new Date(x.day + 'T12:00:00Z'))}: ${toman(x.revenue)} تومان، ${fa(x.orders)} سفارش`, highlight: i === days.length - 1 }));
  return (
    <>
      <PageHead title="گزارش‌ها" desc="آمار فروش بر پایه‌ی سفارش‌های غیرلغو و غیرمرجوعی؛ هر شاخص با دوره‌ی قبلیِ هم‌طول مقایسه می‌شود.">
        <div className="seg" role="group" aria-label="بازه">{[7, 30, 90].map((x) => <Link key={x} href={`/admin/reports?days=${x}`} aria-current={d === x ? 'true' : undefined} className={d === x ? 'on' : ''}>{fa(x)} روز اخیر</Link>)}</div>
        <a className="btn btn-secondary" href={`/admin/export/orders?days=${d}`}><Download />خروجی سفارش‌ها</a>
      </PageHead>
      <div className="ad-kpis">
        <Kpi label="فروش کل" value={toman(cur.revenue)} unit="تومان" delta={delta(cur.revenue, prev.revenue)} />
        <Kpi label="تعداد سفارش" value={fa(cur.orders)} delta={delta(cur.orders, prev.orders)} />
        <Kpi label="میانگین ارزش سفارش" value={toman(cur.avg)} unit="تومان" delta={delta(cur.avg, prev.avg)} />
        <Kpi label="کالای فروخته‌شده" value={fa(cur.items)} unit="عدد" delta={delta(cur.items, prev.items)} />
      </div>
      <div className="ad-stack">
        <Card title={`فروش روزانه (${fa(d)} روز اخیر)`}><BarChart data={bars} height={240} /></Card>
        <div className="ad-grid2" style={{ alignItems: 'start' }}>
          <Card title="پرفروش‌ترین محصولات" tight>
            {top.length === 0 ? <EmptyState title="داده‌ای نیست" /> : (
              <div className="ad-tablewrap"><table className="ad-table"><thead><tr><th>محصول</th><th className="num-col">تعداد</th><th className="num-col">فروش (تومان)</th></tr></thead>
                <tbody>{top.map((t) => <tr key={t.name}><td>{t.name}</td><td className="num-col">{fa(t.qty)}</td><td className="num-col">{toman(t.revenue)}</td></tr>)}</tbody></table></div>
            )}
          </Card>
          <Card title="فروش بر اساس دسته" tight><Bars rows={cats.map((c) => ({ name: c.name, v: c.revenue }))} fmt={(n) => toman(n)} /></Card>
          <Card title="فروش بر اساس برند" tight><Bars rows={brands.map((c) => ({ name: c.name, v: c.revenue }))} fmt={(n) => toman(n)} /></Card>
          <Card title="وضعیت سفارش‌ها" tight><Bars rows={st.map((s) => ({ name: ORDER_STATUS[s.status]?.label ?? s.status, v: s.n }))} /></Card>
          <Card title="روش پرداخت" tight><Bars rows={pm.map((p) => ({ name: PAY_METHOD[p.payment_method], v: p.revenue }))} fmt={(n) => toman(n)} /></Card>
          <Card title="کدهای تخفیف پراستفاده" tight>{coupons.length === 0 ? <EmptyState title="هنوز استفاده‌ای نشده" /> : <Bars rows={coupons.map((c) => ({ name: c.code, v: c.used }))} />}</Card>
        </div>
      </div>
    </>
  );
}
