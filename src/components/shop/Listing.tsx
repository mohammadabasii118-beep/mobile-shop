import Link from 'next/link';
import { ChevronLeft, SearchX } from 'lucide-react';
import { getAttributes, getBrands, getCategories, getSettings, listProducts, type ListOpts } from '@/lib/catalog';
import { ATTR } from '@/lib/variations';
import { fa, normText, toInt } from '@/lib/format';
import ProductGrid from './ProductGrid';
import Filters from './Filters';
import SortSelect from './SortSelect';
import MyPhone from './MyPhone';

export type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const PER_PAGE = 12;

export function paramsOf(sp: SP) {
  return {
    q: normText(one(sp.q)).slice(0, 80),
    brand: one(sp.brand),
    model: one(sp.model),
    cat: one(sp.cat),
    min: toInt(one(sp.min), 0),
    max: toInt(one(sp.max), 0),
    stock: one(sp.stock) === '1',
    sale: one(sp.sale) === '1',
    sort: (['new', 'popular', 'price_asc', 'price_desc'].includes(one(sp.sort)) ? one(sp.sort) : 'new') as NonNullable<ListOpts['sort']>,
    page: Math.max(1, toInt(one(sp.page), 1)),
  };
}

function link(basePath: string, sp: SP, patch: Record<string, string | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp })) {
    const val = one(v);
    if (val) p.set(k, val);
  }
  for (const [k, v] of Object.entries(patch)) (v === null ? p.delete(k) : p.set(k, v));
  const s = p.toString();
  return s ? `${basePath}?${s}` : basePath;
}

export default function Listing({
  basePath, sp, categoryId, showCategories = false, forceQ, emptyHint,
}: { basePath: string; sp: SP; categoryId?: number; showCategories?: boolean; forceQ?: string; emptyHint?: React.ReactNode }) {
  const f = paramsOf(sp);
  const settings = getSettings();
  const cats = getCategories();
  const catRow = showCategories && f.cat ? cats.find((c) => c.slug === f.cat) : undefined;
  const brands = getBrands();
  const attrs = getAttributes();
  const brandAttr = attrs.find((a) => a.slug === ATTR.brand);
  const modelAttr = attrs.find((a) => a.slug === ATTR.model);
  const phoneBrands = brandAttr?.terms.map((t) => ({ slug: t.slug, name: t.name })) ?? [];
  const phoneModels = modelAttr?.terms.map((t) => ({ slug: t.slug, name: t.name, parent: brandAttr?.terms.find((b) => b.id === t.parent_term_id)?.slug ?? '' })) ?? [];

  const { items, total } = listProducts({
    q: forceQ ?? f.q, categoryId: categoryId ?? catRow?.id, brandSlug: f.brand || undefined, model: f.model || undefined,
    minPrice: f.min || undefined, maxPrice: f.max || undefined, inStock: f.stock, onSale: f.sale, sort: f.sort, page: f.page, limit: PER_PAGE,
  });
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const active: { label: string; href: string }[] = [];
  if (f.brand) active.push({ label: brands.find((b) => b.slug === f.brand)?.name ?? f.brand, href: link(basePath, sp, { brand: null, page: null }) });
  if (f.model) active.push({ label: phoneModels.find((m) => m.slug === f.model)?.name ?? f.model, href: link(basePath, sp, { model: null, page: null }) });
  if (catRow) active.push({ label: catRow.name, href: link(basePath, sp, { cat: null, page: null }) });
  if (f.min) active.push({ label: `از ${fa(f.min)} تومان`, href: link(basePath, sp, { min: null, page: null }) });
  if (f.max) active.push({ label: `تا ${fa(f.max)} تومان`, href: link(basePath, sp, { max: null, page: null }) });
  if (f.stock) active.push({ label: 'فقط موجود', href: link(basePath, sp, { stock: null, page: null }) });
  if (f.sale) active.push({ label: 'تخفیف‌دار', href: link(basePath, sp, { sale: null, page: null }) });

  return (
    <div className="wrap listing">
      <Filters
        d={{
          basePath, q: forceQ ?? f.q, categories: showCategories ? cats.filter((c) => !c.parent_id).map((c) => ({ slug: c.slug, name: c.name })) : undefined,
          currentCategory: f.cat, brands: brands.map((b) => ({ slug: b.slug, name: b.name })),
          current: { brand: f.brand, model: f.model, min: f.min ? String(f.min) : '', max: f.max ? String(f.max) : '', stock: f.stock, sale: f.sale, sort: f.sort },
          phoneBrands, phoneModels, activeCount: active.length,
        }}
      />
      <div>
        {!f.model && phoneModels.length > 0 && <MyPhone models={phoneModels} basePath={basePath} />}
        <div className="toolbar">
          <span className="total num">{fa(total)} کالا</span>
          <SortSelect value={f.sort} />
        </div>
        {active.length > 0 && (
          <div className="active-filters">
            {active.map((a) => <Link key={a.label} className="chip" href={a.href}>{a.label} ×</Link>)}
          </div>
        )}
        {items.length ? (
          <ProductGrid items={items} low={Number(settings.low_stock) || 5} cols={3} />
        ) : (
          <div className="empty">
            <SearchX className="big" />
            <h2>کالایی پیدا نشد</h2>
            <p>{emptyHint ?? 'فیلترها را تغییر دهید یا عبارت دیگری را جستجو کنید.'}</p>
            {active.length > 0 && <Link className="btn btn-primary" href={forceQ ? `${basePath}?q=${encodeURIComponent(forceQ)}` : basePath}>حذف فیلترها</Link>}
          </div>
        )}
        {pages > 1 && (
          <nav className="pager" aria-label="صفحه‌بندی">
            {f.page > 1 && <Link href={link(basePath, sp, { page: String(f.page - 1) })} aria-label="صفحه‌ی قبل"><ChevronLeft style={{ width: 18, transform: 'scaleX(-1)' }} /></Link>}
            {Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - f.page) <= 1).map((n, i, arr) => (
              <span key={n} style={{ display: 'contents' }}>
                {i > 0 && n - arr[i - 1] > 1 && <span aria-hidden>…</span>}
                {n === f.page ? <span className="cur" aria-current="page">{fa(n)}</span> : <Link href={link(basePath, sp, { page: String(n) })}>{fa(n)}</Link>}
              </span>
            ))}
            {f.page < pages && <Link href={link(basePath, sp, { page: String(f.page + 1) })} aria-label="صفحه‌ی بعد"><ChevronLeft style={{ width: 18 }} /></Link>}
          </nav>
        )}
      </div>
    </div>
  );
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="wrap crumbs" aria-label="مسیر صفحه">
      <Link href="/">خانه</Link>
      {items.map((c, i) => (
        <span key={i} style={{ display: 'contents' }}>
          <ChevronLeft aria-hidden />
          {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page" style={{ color: 'var(--ink)' }}>{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}
