'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SlidersHorizontal, X, Smartphone } from 'lucide-react';

export type FilterData = {
  basePath: string;
  q?: string;
  categories?: { slug: string; name: string }[];
  currentCategory?: string;
  brands: { slug: string; name: string }[];
  current: { brand: string; model: string; min: string; max: string; stock: boolean; sale: boolean; sort: string };
  phoneBrands: { slug: string; name: string }[];
  phoneModels: { slug: string; name: string; parent: string }[];
  activeCount: number;
};

export default function Filters({ d }: { d: FilterData }) {
  const [open, setOpen] = useState(false);
  const modelBrand = d.phoneModels.find((m) => m.slug === d.current.model)?.parent ?? '';
  const [pb, setPb] = useState(modelBrand);
  const [pm, setPm] = useState(d.current.model);

  useEffect(() => {
    document.body.style.overflow = open && window.innerWidth < 1024 ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const models = d.phoneModels.filter((m) => m.parent === pb);

  return (
    <>
      <button className="btn btn-secondary btn-sm filter-btn" onClick={() => setOpen(true)} aria-expanded={open}>
        <SlidersHorizontal className="i" style={{ width: 16, height: 16 }} /> فیلترها{d.activeCount > 0 ? ` (${d.activeCount.toLocaleString('fa-IR')})` : ''}
      </button>
      <form
        className={`filters${open ? ' open' : ''}`} method="get" action={d.basePath} aria-label="فیلتر محصولات"
        onSubmit={() => {
          try { if (pm) localStorage.setItem('vt_phone', JSON.stringify({ brand: pb, model: pm })); } catch { /* noop */ }
        }}
      >
        <div className="f-head"><b style={{ fontSize: 18 }}>فیلترها</b><button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="بستن فیلترها"><X className="i" /></button></div>
        {d.q && <input type="hidden" name="q" value={d.q} />}
        <input type="hidden" name="sort" value={d.current.sort} />

        {d.phoneBrands.length > 0 && (
          <div className="fgroup">
            <h3><Smartphone className="i" style={{ width: 18, height: 18 }} /> سازگار با گوشی من</h3>
            <div className="form" style={{ gap: 10 }}>
              <select className="sel" style={{ height: 44 }} aria-label="برند گوشی" value={pb} onChange={(e) => { setPb(e.target.value); setPm(''); }}>
                <option value="">برند گوشی</option>
                {d.phoneBrands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
              </select>
              <select className="sel" style={{ height: 44 }} name="model" aria-label="مدل گوشی" value={pm} disabled={!pb} onChange={(e) => setPm(e.target.value)}>
                <option value="">{pb ? 'مدل گوشی' : 'ابتدا برند را انتخاب کنید'}</option>
                {models.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
              </select>
              <span className="help" style={{ fontSize: 12.5, color: 'var(--mute)' }}>شامل محصولات عمومی مثل شارژر و کابل هم می‌شود.</span>
            </div>
          </div>
        )}

        {d.categories && d.categories.length > 0 && (
          <div className="fgroup">
            <h3>دسته‌بندی</h3>
            <div className="opts">
              <label className="opt"><input type="radio" name="cat" value="" defaultChecked={!d.currentCategory} /> همه</label>
              {d.categories.map((c) => <label key={c.slug} className="opt"><input type="radio" name="cat" value={c.slug} defaultChecked={d.currentCategory === c.slug} /> {c.name}</label>)}
            </div>
          </div>
        )}

        <div className="fgroup">
          <h3>برند</h3>
          <div className="opts">
            <label className="opt"><input type="radio" name="brand" value="" defaultChecked={!d.current.brand} /> همه</label>
            {d.brands.map((b) => <label key={b.slug} className="opt"><input type="radio" name="brand" value={b.slug} defaultChecked={d.current.brand === b.slug} /> <bdi>{b.name}</bdi></label>)}
          </div>
        </div>

        <div className="fgroup">
          <h3>محدوده‌ی قیمت (تومان)</h3>
          <div className="frow">
            <input className="field-sm num" inputMode="numeric" name="min" placeholder="از" defaultValue={d.current.min} aria-label="حداقل قیمت" />
            <input className="field-sm num" inputMode="numeric" name="max" placeholder="تا" defaultValue={d.current.max} aria-label="حداکثر قیمت" />
          </div>
        </div>

        <div className="fgroup">
          <div className="opts">
            <label className="opt"><input type="checkbox" name="stock" value="1" defaultChecked={d.current.stock} /> فقط کالاهای موجود</label>
            <label className="opt"><input type="checkbox" name="sale" value="1" defaultChecked={d.current.sale} /> فقط کالاهای تخفیف‌دار</label>
          </div>
        </div>

        <div className="f-apply">
          <button className="btn btn-primary btn-block" type="submit">اعمال فیلترها</button>
          {d.activeCount > 0 && <Link className="btn btn-secondary" href={d.q ? `${d.basePath}?q=${encodeURIComponent(d.q)}` : d.basePath}>حذف</Link>}
        </div>
      </form>
    </>
  );
}
