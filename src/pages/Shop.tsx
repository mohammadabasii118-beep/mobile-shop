import { useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Check, SlidersHorizontal, ArrowDownUp, Search } from 'lucide-react';
import { products, brands, allModels, allColors } from '@/data/products';
import { categories } from '@/data/categories';
import { useFilters, defaultFilters, type Filters } from '@/store';
import { searchProducts } from '@/utils/search';
import { discountPercent, formatPrice, toFa } from '@/utils/format';
import { useSEO } from '@/utils/seo';
import { PageShell } from '@/components/PageShell';
import { ProductGrid } from '@/components/ProductGrid';
import { Sheet } from '@/components/Sheet';

const sorts: { v: Filters['sort']; l: string }[] = [
  { v: 'popular', l: 'پرفروش‌ترین' }, { v: 'new', l: 'جدیدترین' }, { v: 'cheap', l: 'ارزان‌ترین' }, { v: 'expensive', l: 'گران‌ترین' }, { v: 'discount', l: 'بیشترین تخفیف' },
];

function toggle(arr: string[], v: string) { return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]; }

function FilterPanel() {
  const { filters: f, set, reset } = useFilters();
  const Group = ({ title, items, k }: { title: string; items: string[]; k: 'categories' | 'brands' | 'models' | 'colors' }) => (
    <div className="border-b border-line py-5">
      <h4 className="mb-3 text-sm font-black text-white">{title}</h4>
      <div className="flex flex-wrap gap-2">{items.map((i) => <button key={i} onClick={() => set({ [k]: toggle(f[k], i) })} className={`chip ${f[k].includes(i) ? 'chip-on' : 'text-mist/70'}`}>{i}</button>)}</div>
    </div>
  );
  return (
    <div>
      <Group title="دسته‌بندی" items={categories.map((c) => c.name)} k="categories" />
      <Group title="برند" items={brands} k="brands" />
      <Group title="مدل گوشی" items={allModels} k="models" />
      <Group title="رنگ" items={allColors.map((c) => c.name)} k="colors" />
      <div className="border-b border-line py-5">
        <h4 className="mb-3 flex justify-between text-sm font-black text-white"><span>حداکثر قیمت</span><span className="text-violet">{formatPrice(f.maxPrice)}</span></h4>
        <input type="range" min={100_000} max={2_000_000} step={50_000} value={f.maxPrice} onChange={(e) => set({ maxPrice: +e.target.value })} className="w-full accent-violet" style={{ direction: 'ltr' }} />
      </div>
      {([['inStock', 'فقط کالاهای موجود'], ['discounted', 'فقط تخفیف‌دار']] as const).map(([k, l]) => (
        <label key={k} className="flex cursor-pointer items-center justify-between border-b border-line py-4 text-sm text-white">{l}
          <span className={`grid h-6 w-11 items-center rounded-full px-0.5 transition ${f[k] ? 'bg-violet' : 'bg-white/15'}`}><input type="checkbox" hidden checked={f[k]} onChange={() => set({ [k]: !f[k] })} /><span className={`h-5 w-5 rounded-full bg-white transition ${f[k] ? '-translate-x-5' : ''}`} /></span></label>
      ))}
      <button onClick={reset} className="btn btn-ghost mt-5 w-full">پاک کردن فیلترها</button>
    </div>
  );
}

export default function Shop() {
  const { slug } = useParams();
  const [sp] = useSearchParams();
  const { filters: f, set, reset, filterOpen, sortOpen, setFilterOpen, setSortOpen } = useFilters();
  const cat = categories.find((c) => c.slug === slug);

  useEffect(() => {
    reset();
    const patch: Partial<Filters> = {};
    if (cat) patch.categories = [cat.name];
    if (sp.get('q')) patch.q = sp.get('q')!;
    if (sp.get('sort')) patch.sort = sp.get('sort') as Filters['sort'];
    if (sp.get('discounted')) patch.discounted = true;
    set(patch);
  }, [slug, sp.toString()]);

  const list = useMemo(() => {
    let r = searchProducts(products, f.q).filter((p) => {
      const cn = categories.find((c) => c.slug === p.category)!.name;
      return (!f.categories.length || f.categories.includes(cn))
        && (!f.brands.length || f.brands.includes(p.brand))
        && (!f.models.length || p.models.some((m) => f.models.includes(m)))
        && (!f.colors.length || p.colors.some((c) => f.colors.includes(c.name)))
        && p.price <= f.maxPrice && (!f.inStock || p.stock > 0) && (!f.discounted || discountPercent(p.price, p.oldPrice) > 0);
    });
    const rank = { popular: (p: typeof r[0]) => -p.reviewCount, new: (p: typeof r[0]) => (p.isNew ? 0 : 1), cheap: (p: typeof r[0]) => p.price, expensive: (p: typeof r[0]) => -p.price, discount: (p: typeof r[0]) => -discountPercent(p.price, p.oldPrice) }[f.sort];
    return [...r].sort((a, b) => rank(a) - rank(b));
  }, [f]);

  const title = cat?.name ?? 'فروشگاه';
  useSEO({ title, description: cat ? `خرید ${cat.name} با بهترین قیمت از CaseLine. ${cat.description}.` : undefined });
  const activeCount = f.categories.length + f.brands.length + f.models.length + f.colors.length + +f.inStock + +f.discounted + +(f.maxPrice < defaultFilters.maxPrice);

  return (
    <PageShell title={title} subtitle={cat?.description ?? 'همه‌ی قاب‌ها و لوازم جانبی CaseLine'}>
      <div className="mb-6 flex items-center gap-2">
        <div className="relative flex-1"><Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-mist/40" /><input className="input !pr-11" placeholder="جستجوی محصولات…" value={f.q} onChange={(e) => set({ q: e.target.value })} /></div>
        <button className="btn btn-ghost lg:hidden" onClick={() => setFilterOpen(true)}><SlidersHorizontal size={16} />فیلتر{activeCount > 0 && <b className="text-violet">{toFa(activeCount)}</b>}</button>
        <button className="btn btn-ghost lg:hidden" onClick={() => setSortOpen(true)}><ArrowDownUp size={16} />مرتب‌سازی</button>
        <select className="input hidden !w-52 lg:block" value={f.sort} onChange={(e) => set({ sort: e.target.value as Filters['sort'] })}>{sorts.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select>
      </div>
      <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block"><div className="sticky top-24"><FilterPanel /></div></aside>
        <div>
          <p className="mb-4 text-sm text-mist/60">{toFa(list.length)} محصول</p>
          {list.length ? <ProductGrid items={list} /> : <div className="card p-12 text-center text-mist/60">محصولی با این فیلترها پیدا نشد.</div>}
        </div>
      </div>
      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="فیلترها" side="bottom"><div className="px-5 pb-6"><FilterPanel /><button onClick={() => setFilterOpen(false)} className="btn btn-primary mt-4 w-full">نمایش {toFa(list.length)} محصول</button></div></Sheet>
      <Sheet open={sortOpen} onClose={() => setSortOpen(false)} title="مرتب‌سازی" side="bottom">
        <div className="p-3">{sorts.map((s) => <button key={s.v} onClick={() => { set({ sort: s.v }); setSortOpen(false); }} className="flex w-full items-center justify-between rounded-2xl px-4 py-4 text-sm font-bold text-white hover:bg-white/5">{s.l}{f.sort === s.v && <Check size={18} className="text-violet" />}</button>)}</div>
      </Sheet>
    </PageShell>
  );
}
