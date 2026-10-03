import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { Product, Variant } from '@/types';
import { buildVariants, variantAvailable } from '@/data/variants';
import { formatPrice, toFa } from '@/utils/format';

/** ویرایشگر واریانت‌ها: مدل‌ها + رنگ‌ها → ماتریس ترکیب‌ها (SKU، قیمت، موجودی) — DESIGN.md §7 */
export function VariantsEditor({ draft, setDraft, variants, setVariants }: { draft: Product; setDraft: (p: Product) => void; variants: Variant[]; setVariants: (v: Variant[]) => void }) {
  const [model, setModel] = useState(''); const [cname, setCname] = useState(''); const [chex, setChex] = useState('#7357f6'); const [bulk, setBulk] = useState('');
  const apply = (p: Product) => { setDraft(p); setVariants(buildVariants(p, variants)); };
  const addModel = () => { const m = model.trim(); if (!m || draft.models.includes(m)) return; apply({ ...draft, models: [...draft.models, m] }); setModel(''); };
  const addColor = () => { const n = cname.trim(); if (!n || draft.colors.some((c) => c.name === n)) return; apply({ ...draft, colors: [...draft.colors, { name: n, hex: chex }] }); setCname(''); };
  const patch = (id: string, p: Partial<Variant>) => setVariants(variants.map((v) => (v.id === id ? { ...v, ...p } : v)));
  const num = (s: string) => +s.replace(/\D/g, '');
  const total = variants.reduce((s, v) => s + variantAvailable(v), 0);
  return (
    <div>
      <div className="two">
        <div><label className="field"><span>۱. مدل‌های گوشی ({toFa(draft.models.length)})</span></label>
          <div className="tagrow">{draft.models.map((m) => <span className="tagx" key={m}>{m}<button aria-label={`حذف ${m}`} onClick={() => apply({ ...draft, models: draft.models.filter((x) => x !== m) })}><X size={12} /></button></span>)}{!draft.models.length && <span className="cap">هنوز مدلی اضافه نشده است.</span>}</div>
          <div className="addrow"><input className="inp" id="v-model" placeholder="مثلاً آیفون ۱۶ پرو مکس" value={model} onChange={(e) => setModel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addModel()} /><button className="btn btn-s btn-sm" onClick={addModel}><Plus size={14} />افزودن مدل</button></div></div>
        <div><label className="field"><span>۲. رنگ‌ها ({toFa(draft.colors.length)})</span></label>
          <div className="tagrow">{draft.colors.map((c) => <span className="tagx" key={c.name}><i style={{ background: c.hex }} />{c.name}<button aria-label={`حذف ${c.name}`} onClick={() => apply({ ...draft, colors: draft.colors.filter((x) => x.name !== c.name) })}><X size={12} /></button></span>)}{!draft.colors.length && <span className="cap">هنوز رنگی اضافه نشده است.</span>}</div>
          <div className="addrow"><input type="color" className="cp" aria-label="انتخاب رنگ" value={chex} onChange={(e) => setChex(e.target.value)} /><input className="inp" id="v-color" placeholder="نام رنگ، مثلاً بنفش" value={cname} onChange={(e) => setCname(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addColor()} /><button className="btn btn-s btn-sm" onClick={addColor}><Plus size={14} />افزودن رنگ</button></div></div>
      </div>
      <h4 style={{ margin: '20px 0 4px', fontSize: 15, color: 'var(--ink)' }}>۳. ترکیب‌ها ({toFa(variants.length)}) · موجودی کل {toFa(total)}</h4>
      <p className="cap">ترکیب‌ها خودکار ساخته می‌شوند. با تغییر مدل یا رنگ، SKU و موجودی ترکیب‌های قبلی حفظ می‌شود.</p>
      <div className="bulk"><input className="inp ltr" id="v-bulk" inputMode="numeric" placeholder="موجودی" value={bulk} onChange={(e) => setBulk(e.target.value.replace(/\D/g, ''))} /><button className="btn btn-s btn-sm" onClick={() => bulk !== '' && setVariants(variants.map((v) => ({ ...v, stock: +bulk })))}>اعمال روی همه</button><button className="btn btn-s btn-sm" onClick={() => setVariants(variants.map((v) => ({ ...v, price: undefined })))}>پاک کردن قیمت‌های اختصاصی</button></div>
      {variants.length ? (
        <div className="vm"><table><thead><tr><th>فعال</th><th>مدل</th><th>رنگ</th><th>SKU</th><th>قیمت (اختیاری)</th><th>موجودی</th><th>وضعیت</th></tr></thead><tbody>
          {variants.map((v) => { const a = variantAvailable(v); const c = !v.active ? 'var(--subtle)' : a <= 0 ? 'var(--danger)' : a <= 3 ? 'var(--warn)' : 'var(--ok)'; return (
            <tr key={v.id}><td><button className="sw-t" aria-pressed={v.active} aria-label="فعال" onClick={() => patch(v.id, { active: !v.active })}><i /></button></td><td>{v.model}</td><td><span className="dotc" style={{ background: v.color.hex }} />{v.color.name}</td>
              <td><input className="inp mono-in" aria-label="SKU" value={v.sku} onChange={(e) => patch(v.id, { sku: e.target.value })} /></td>
              <td><input className="inp ltr" style={{ width: 130 }} aria-label="قیمت" inputMode="numeric" placeholder={String(draft.price || '')} value={v.price ?? ''} onChange={(e) => patch(v.id, { price: e.target.value === '' ? undefined : num(e.target.value) })} /></td>
              <td><input className="inp ltr" style={{ width: 80 }} aria-label="موجودی" inputMode="numeric" value={v.stock} onChange={(e) => patch(v.id, { stock: num(e.target.value) })} /></td>
              <td><span className="st"><i style={{ background: c }} />{!v.active ? 'غیرفعال' : a <= 0 ? 'ناموجود' : a <= 3 ? `کم · ${toFa(a)}` : toFa(a)}</span></td></tr>); })}
        </tbody></table></div>
      ) : <div className="empty panel" style={{ background: 'var(--canvas)' }}><b style={{ color: 'var(--ink)' }}>ابتدا حداقل یک مدل و یک رنگ اضافه کنید</b><p>سپس ترکیب‌ها اینجا ساخته می‌شوند. قیمت پایه: {formatPrice(draft.price)}</p></div>}
    </div>
  );
}
