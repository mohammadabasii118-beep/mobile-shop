import type { Metadata } from 'next';
import Link from 'next/link';
import { Copy, ExternalLink, Pencil, Plus, Search } from 'lucide-react';
import { all, get } from '@/lib/db';
import { getCategories, getSettings } from '@/lib/catalog';
import { fa, normText, toman } from '@/lib/format';
import { Card, EmptyState, PageHead, Pagination, Pill, qsLink, one } from '@/components/admin/ui';
import { ConfirmForm, QuickAction } from '@/components/admin/client';
import { bulkProducts, deleteProduct, duplicateProduct, toggleProductStatus } from '@/lib/actions/admin-catalog';
import SelectAll from '@/components/admin/SelectAll';
import Pic from '@/components/shop/Pic';

export const metadata: Metadata = { title: 'محصولات' };
const PER = 20;

type Row = { id: number; name: string; slug: string; sku: string | null; type: string; status: string; featured: number; images: string; cat: string | null; brand: string | null; pmin: number; pmax: number; stock: number; vcount: number; sale: number };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = normText(one(sp.q)), status = one(sp.status), cat = Number(one(sp.cat)) || 0, type = one(sp.type), stock = one(sp.stock);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const low = Number(getSettings().low_stock) || 5;
  const cats = getCategories(false);

  const where: string[] = []; const args: unknown[] = [];
  if (q) { where.push('(name LIKE ? OR sku LIKE ? OR brand LIKE ?)'); const l = `%${q}%`; args.push(l, l, l); }
  if (status === 'published' || status === 'draft') { where.push('status = ?'); args.push(status); }
  if (cat) { where.push('category_id = ?'); args.push(cat); }
  if (type === 'simple' || type === 'variable') { where.push('type = ?'); args.push(type); }
  if (stock === 'out') where.push('stock <= 0'); else if (stock === 'low') where.push('stock > 0 AND stock <= ?'), args.push(low);
  const W = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const BASE = `WITH b AS (
    SELECT p.id, p.name, p.slug, p.sku, p.type, p.status, p.featured, p.images, p.category_id, c.name cat, br.name brand,
      CASE WHEN p.type='variable' THEN COALESCE((SELECT MIN(COALESCE(CASE WHEN v.sale_price>0 AND v.sale_price<v.price THEN v.sale_price END, v.price)) FROM variations v WHERE v.product_id=p.id AND v.status='active'),0) ELSE COALESCE(CASE WHEN p.sale_price>0 AND p.sale_price<p.price THEN p.sale_price END, p.price) END pmin,
      CASE WHEN p.type='variable' THEN COALESCE((SELECT MAX(COALESCE(CASE WHEN v.sale_price>0 AND v.sale_price<v.price THEN v.sale_price END, v.price)) FROM variations v WHERE v.product_id=p.id AND v.status='active'),0) ELSE COALESCE(CASE WHEN p.sale_price>0 AND p.sale_price<p.price THEN p.sale_price END, p.price) END pmax,
      CASE WHEN p.type='variable' THEN COALESCE((SELECT SUM(v.stock) FROM variations v WHERE v.product_id=p.id AND v.status='active'),0) ELSE p.stock END stock,
      (SELECT COUNT(*) FROM variations v WHERE v.product_id=p.id) vcount,
      CASE WHEN p.type='variable' THEN EXISTS(SELECT 1 FROM variations v WHERE v.product_id=p.id AND v.sale_price>0 AND v.sale_price<v.price) ELSE (p.sale_price>0 AND p.sale_price<p.price) END sale
    FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN brands br ON br.id=p.brand_id) `;
  const total = get<{ n: number }>(`${BASE} SELECT COUNT(*) n FROM b ${W}`, ...args)!.n;
  const rows = all<Row>(`${BASE} SELECT * FROM b ${W} ORDER BY id DESC LIMIT ? OFFSET ?`, ...args, PER, (page - 1) * PER);
  const counts = { all: get<{ n: number }>('SELECT COUNT(*) n FROM products')!.n, pub: get<{ n: number }>("SELECT COUNT(*) n FROM products WHERE status='published'")!.n, draft: get<{ n: number }>("SELECT COUNT(*) n FROM products WHERE status='draft'")!.n };
  const href = (p: number) => qsLink('/admin/products', sp, { page: String(p) });
  const filtered = !!(q || status || cat || type || stock);

  return (
    <>
      <PageHead title="محصولات" desc="همه‌ی کالاهای فروشگاه؛ محصول ساده یا متغیر (مثل قاب با برند، مدل و رنگ)."><Link className="btn btn-primary" href="/admin/products/new"><Plus />محصول جدید</Link></PageHead>
      <Card tight>
        <nav className="ad-tabs" aria-label="وضعیت">
          <Link href="/admin/products" aria-current={!status ? 'page' : undefined}>همه <span className="c num">{fa(counts.all)}</span></Link>
          <Link href="/admin/products?status=published" aria-current={status === 'published' ? 'page' : undefined}>منتشرشده <span className="c num">{fa(counts.pub)}</span></Link>
          <Link href="/admin/products?status=draft" aria-current={status === 'draft' ? 'page' : undefined}>پیش‌نویس <span className="c num">{fa(counts.draft)}</span></Link>
        </nav>
        <div className="ad-toolbar">
          <form method="get" action="/admin/products">
            {status && <input type="hidden" name="status" value={status} />}
            <label className="ad-search grow"><Search className="i" style={{ width: 18 }} /><input name="q" defaultValue={q} placeholder="جستجوی نام، کد یا برند…" aria-label="جستجوی محصول" /></label>
            <select className="sel" name="cat" defaultValue={cat || ''} style={{ width: 'auto', minWidth: 140 }} aria-label="دسته‌بندی"><option value="">همه‌ی دسته‌ها</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select className="sel" name="type" defaultValue={type} style={{ width: 'auto' }} aria-label="نوع"><option value="">همه‌ی انواع</option><option value="simple">ساده</option><option value="variable">متغیر</option></select>
            <select className="sel" name="stock" defaultValue={stock} style={{ width: 'auto' }} aria-label="موجودی"><option value="">همه‌ی موجودی‌ها</option><option value="low">کم‌موجودی</option><option value="out">ناموجود</option></select>
            <button className="btn btn-secondary">فیلتر</button>
            {filtered && <Link className="link" href="/admin/products">حذف فیلترها</Link>}
          </form>
        </div>
        {rows.length === 0 ? (
          <EmptyState title={filtered ? 'محصولی با این فیلتر پیدا نشد' : 'هنوز محصولی ندارید'} desc={filtered ? undefined : 'اولین محصول را اضافه کنید.'}>{!filtered && <Link className="btn btn-primary" href="/admin/products/new"><Plus />افزودن محصول</Link>}</EmptyState>
        ) : (
          <form id="bulk" action={bulkProducts}>
            <div className="bulkbar">
              <span className="mute" style={{ fontSize: 12.5 }}>برای موارد انتخاب‌شده:</span>
              <select className="sel" name="op" style={{ width: 'auto', height: 34 }} aria-label="عملیات گروهی" defaultValue="publish">
                <option value="publish">انتشار</option><option value="draft">تبدیل به پیش‌نویس</option><option value="feature">ویژه کردن</option><option value="unfeature">برداشتن ویژه</option><option value="delete">حذف</option>
              </select>
              <button className="btn btn-secondary btn-sm">اعمال</button>
            </div>
            <div className="ad-tablewrap">
              <table className="ad-table cards">
                <thead><tr><th style={{ width: 36 }}><SelectAll /></th><th>محصول</th><th>نوع</th><th>دسته</th><th className="num-col">قیمت (تومان)</th><th className="num-col">موجودی</th><th>وضعیت</th><th /></tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const img = (JSON.parse(r.images) as string[])[0];
                    const stockTone = r.stock <= 0 ? 'danger' : r.stock <= low ? 'warning' : 'muted';
                    return (
                      <tr key={r.id}>
                        <td className="full"><input type="checkbox" name="ids" value={r.id} aria-label={`انتخاب ${r.name}`} style={{ width: 16, height: 16, accentColor: 'var(--ink)' }} /></td>
                        <td className="full"><Link className="pn" href={`/admin/products/${r.id}`}><span className="thumb"><Pic src={img} /></span><span><b>{r.name}</b><small>{r.brand ?? 'بدون برند'}{r.sku ? ` · ${r.sku}` : ''}{r.featured ? ' · ویژه' : ''}</small></span></Link></td>
                        <td data-label="نوع">{r.type === 'variable' ? <Pill tone="action">متغیر · {fa(r.vcount)}</Pill> : <Pill tone="muted">ساده</Pill>}</td>
                        <td data-label="دسته" className="mute">{r.cat ?? '—'}</td>
                        <td data-label="قیمت" className="num-col">{r.pmax === 0 ? '—' : r.pmin === r.pmax ? toman(r.pmin) : `${toman(r.pmin)} – ${toman(r.pmax)}`}{r.sale ? <span className="pill danger" style={{ marginInlineStart: 6 }}>تخفیف</span> : null}</td>
                        <td data-label="موجودی" className="num-col"><Pill tone={stockTone}>{r.stock <= 0 ? 'ناموجود' : fa(r.stock)}</Pill></td>
                        <td data-label="وضعیت"><QuickAction action={toggleProductStatus.bind(null, r.id)} className="btn btn-sm btn-secondary" title="تغییر وضعیت">{r.status === 'published' ? 'منتشر شده' : 'پیش‌نویس'}</QuickAction></td>
                        <td className="full"><div className="actions">
                          <Link className="icon-btn" href={`/admin/products/${r.id}`} aria-label="ویرایش" title="ویرایش"><Pencil className="i" style={{ width: 17 }} /></Link>
                          <Link className="icon-btn" href={`/product/${encodeURIComponent(r.slug)}`} target="_blank" aria-label="مشاهده در سایت" title="مشاهده در سایت"><ExternalLink className="i" style={{ width: 17 }} /></Link>
                          <QuickAction action={duplicateProduct.bind(null, r.id)} className="icon-btn" title="کپی محصول"><Copy className="i" style={{ width: 17 }} /></QuickAction>
                          <ConfirmForm action={deleteProduct.bind(null, r.id)} label="حذف" message="حذف شود؟" className="btn btn-danger-soft btn-sm" />
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </form>
        )}
        <Pagination page={page} pages={Math.max(1, Math.ceil(total / PER))} total={total} hrefFor={href} per={PER} />
      </Card>
    </>
  );
}
