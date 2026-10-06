import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { all } from '@/lib/db';
import { getSettings } from '@/lib/catalog';
import { fa, jdatetime, normText } from '@/lib/format';
import { Card, EmptyState, PageHead, Pagination, Pill, qsLink, one } from '@/components/admin/ui';
import { ActionForm } from '@/components/admin/client';
import { setStock } from '@/lib/actions/admin-catalog';
import Pic from '@/components/shop/Pic';

export const metadata: Metadata = { title: 'موجودی' };
const PER = 25;

type U = { product_id: number; variation_id: number | null; name: string; label: string; sku: string | null; stock: number; image: string | null };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filter = one(sp.filter), q = normText(one(sp.q));
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const low = Number(getSettings().low_stock) || 5;
  const where: string[] = []; const args: unknown[] = [];
  if (q) { where.push('(name LIKE ? OR sku LIKE ? OR label LIKE ?)'); const l = `%${q}%`; args.push(l, l, l); }
  if (filter === 'low') { where.push('stock > 0 AND stock <= ?'); args.push(low); } else if (filter === 'out') where.push('stock <= 0');
  const W = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const BASE = `WITH u AS (
    SELECT p.id product_id, NULL variation_id, p.name, '' label, p.sku, p.stock, json_extract(p.images,'$[0]') image FROM products p WHERE p.type='simple'
    UNION ALL
    SELECT p.id, v.id, p.name, COALESCE((SELECT GROUP_CONCAT(t.name, ' · ') FROM json_each(v.attrs) j JOIN attributes a ON a.slug=j.key JOIN attribute_terms t ON t.attribute_id=a.id AND t.slug=j.value),''), v.sku, v.stock, COALESCE(v.image, json_extract(p.images,'$[0]'))
    FROM variations v JOIN products p ON p.id=v.product_id WHERE v.status='active') `;
  const total = all<{ n: number }>(`${BASE} SELECT COUNT(*) n FROM u ${W}`, ...args)[0].n;
  const rows = all<U>(`${BASE} SELECT * FROM u ${W} ORDER BY stock ASC, name LIMIT ? OFFSET ?`, ...args, PER, (page - 1) * PER);
  const cnt = all<{ n_out: number; n_low: number; n_all: number }>(`${BASE} SELECT SUM(stock<=0) n_out, SUM(stock>0 AND stock<=${low}) n_low, COUNT(*) n_all FROM u`)[0];
  const log = all<{ id: number; name: string; delta: number; stock_after: number; reason: string; created_at: string; label: string }>(
    `SELECT l.id, p.name, l.delta, l.stock_after, l.reason, l.created_at,
      COALESCE((SELECT GROUP_CONCAT(t.name, ' · ') FROM variations v, json_each(v.attrs) j JOIN attributes a ON a.slug=j.key JOIN attribute_terms t ON t.attribute_id=a.id AND t.slug=j.value WHERE v.id=l.variation_id),'') label
     FROM inventory_log l JOIN products p ON p.id=l.product_id ORDER BY l.id DESC LIMIT 10`);
  const href = (p: number) => qsLink('/admin/inventory', sp, { page: String(p) });

  return (
    <>
      <PageHead title="موجودی انبار" desc={`موجودی هر محصول ساده و هر گونه از محصولات متغیر. آستانه‌ی «کم‌موجودی» ${fa(low)} عدد است (در تنظیمات قابل تغییر).`} />
      <div className="ad-cols wide-side">
        <Card tight>
          <nav className="ad-tabs" aria-label="فیلتر موجودی">
            <Link href="/admin/inventory" aria-current={!filter ? 'page' : undefined}>همه <span className="c num">{fa(cnt.n_all ?? 0)}</span></Link>
            <Link href="/admin/inventory?filter=low" aria-current={filter === 'low' ? 'page' : undefined}>کم‌موجودی <span className="c num">{fa(cnt.n_low ?? 0)}</span></Link>
            <Link href="/admin/inventory?filter=out" aria-current={filter === 'out' ? 'page' : undefined}>ناموجود <span className="c num">{fa(cnt.n_out ?? 0)}</span></Link>
          </nav>
          <div className="ad-toolbar">
            <form method="get" action="/admin/inventory">
              {filter && <input type="hidden" name="filter" value={filter} />}
              <label className="ad-search grow"><Search className="i" style={{ width: 18 }} /><input name="q" defaultValue={q} placeholder="جستجوی محصول، رنگ، مدل یا کد…" aria-label="جستجو" /></label>
              <button className="btn btn-secondary">جستجو</button>
            </form>
          </div>
          {rows.length === 0 ? <EmptyState title="موردی پیدا نشد" /> : (
            <div className="ad-tablewrap"><table className="ad-table cards">
              <thead><tr><th>محصول / گونه</th><th>کد</th><th>وضعیت</th><th className="num-col">موجودی جدید</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={`${r.product_id}-${r.variation_id}`}>
                  <td className="full"><Link className="pn" href={`/admin/products/${r.product_id}`}><span className="thumb"><Pic src={r.image} /></span><span><b>{r.name}</b>{r.label && <small dir="auto">{r.label}</small>}</span></Link></td>
                  <td data-label="کد" className="mute" dir="ltr" style={{ textAlign: 'right' }}>{r.sku ?? '—'}</td>
                  <td data-label="وضعیت"><Pill tone={r.stock <= 0 ? 'danger' : r.stock <= low ? 'warning' : 'success'}>{r.stock <= 0 ? 'ناموجود' : r.stock <= low ? 'کم‌موجودی' : 'موجود'}</Pill></td>
                  <td className="full">
                    <ActionForm key={`${r.stock}`} action={setStock.bind(null, r.product_id, r.variation_id)} className="term-fields" submit="ثبت" submitClass="btn btn-secondary btn-sm" inline>
                      <input className="input num-in num" style={{ flex: '0 0 90px' }} name="stock" defaultValue={r.stock} inputMode="numeric" aria-label={`موجودی ${r.name} ${r.label}`} />
                    </ActionForm>
                  </td>
                </tr>))}</tbody>
            </table></div>
          )}
          <Pagination page={page} pages={Math.max(1, Math.ceil(total / PER))} total={total} hrefFor={href} per={PER} />
        </Card>
        <Card title="آخرین تغییرات موجودی" tight>
          {log.length === 0 ? <EmptyState title="هنوز تغییری ثبت نشده" /> : log.map((l) => (
            <div className="list-rows row" key={l.id} style={{ display: 'flex' }}>
              <span className="t"><b>{l.name}</b><small dir="auto">{l.label ? `${l.label} · ` : ''}{l.reason} · {jdatetime(l.created_at)}</small></span>
              <Pill tone={l.delta > 0 ? 'success' : 'danger'}>{l.delta > 0 ? '+' : '−'}{fa(Math.abs(l.delta))}</Pill>
              <span className="num mute" style={{ minWidth: 28, textAlign: 'end' }}>{fa(l.stock_after)}</span>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
