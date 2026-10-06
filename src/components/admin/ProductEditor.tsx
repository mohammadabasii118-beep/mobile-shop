'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Eye, Layers, Plus, Sparkles, Star, Trash2, Upload, Wand2, X, ImageIcon, Info } from 'lucide-react';
import { saveProduct, type ProductPayload } from '@/lib/actions/admin-catalog';
import { attrsKey, generateCombos, type GenAttr } from '@/lib/variations';
import { fa, slugify, toman } from '@/lib/format';
import { adminToast } from './client';
import Pic, { parseArt } from '../shop/Pic';
import { ART_KEYS, ART_LABELS } from '../shop/Sprite';

export type EdAttribute = { id: number; slug: string; name: string; type: 'select' | 'color'; parent_attribute_id: number | null; terms: { id: number; slug: string; name: string; value: string | null; parent_term_id: number | null }[] };
type Props = {
  initial: ProductPayload;
  categories: { id: number; name: string; depth: number }[];
  brands: { id: number; name: string }[];
  attributes: EdAttribute[];
  isNew: boolean;
};

/* ورودی پول با نمایش فارسی */
function Money({ value, onChange, id, placeholder }: { value: number | null; onChange: (v: number | null) => void; id?: string; placeholder?: string }) {
  return (
    <input
      id={id} className="input num" inputMode="numeric" placeholder={placeholder} value={value ? value.toLocaleString('fa-IR') : ''}
      onChange={(e) => {
        const raw = e.target.value.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '');
        onChange(raw ? Number(raw) : null);
      }}
    />
  );
}

export default function ProductEditor({ initial, categories, brands, attributes, isNew }: Props) {
  const router = useRouter();
  const [p, setP] = useState<ProductPayload>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [uploading, setUploading] = useState(false);
  const [newPrice, setNewPrice] = useState<number | null>(initial.price);
  const [vFilter, setVFilter] = useState('');
  const [imgPick, setImgPick] = useState<number | null>(null);
  const [errors, setErrors] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const vFileRef = useRef<HTMLInputElement>(null);
  const [bulk, setBulk] = useState<{ price: number | null; stock: number | null; pct: string }>({ price: null, stock: null, pct: '' });

  const upd = useCallback((patch: Partial<ProductPayload>) => { setP((c) => ({ ...c, ...patch })); setDirty(true); }, []);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const attrById = useMemo(() => new Map(attributes.map((a) => [a.id, a])), [attributes]);
  const termById = useMemo(() => new Map(attributes.flatMap((a) => a.terms.map((t) => [t.id, { ...t, attr: a }] as const))), [attributes]);
  const usedIds = new Set(p.attributes.map((a) => a.attribute_id));
  const available = attributes.filter((a) => !usedIds.has(a.id));
  const varAttrs = p.attributes.filter((a) => a.for_variations && a.term_ids.length > 0);

  /* ───── تصاویر ───── */
  const upload = async (files: FileList | File[], then: (urls: string[]) => void) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      list.forEach((f) => fd.append('file', f));
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'آپلود انجام نشد');
      then(j.urls);
    } catch (e) {
      adminToast(e instanceof Error ? e.message : 'آپلود انجام نشد', 'err');
    } finally { setUploading(false); }
  };
  const moveImg = (i: number, d: number) => {
    const imgs = [...p.images]; const j = i + d;
    if (j < 0 || j >= imgs.length) return;
    [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
    upd({ images: imgs });
  };

  /* ───── ویژگی‌ها ───── */
  const setAttr = (attribute_id: number, patch: Partial<ProductPayload['attributes'][number]>) =>
    upd({ attributes: p.attributes.map((a) => (a.attribute_id === attribute_id ? { ...a, ...patch } : a)) });
  const toggleTerm = (attrId: number, termId: number) => {
    const cur = p.attributes.find((a) => a.attribute_id === attrId)!;
    const on = cur.term_ids.includes(termId);
    let ids = on ? cur.term_ids.filter((x) => x !== termId) : [...cur.term_ids, termId];
    const next = p.attributes.map((a) => (a.attribute_id === attrId ? { ...a, term_ids: ids } : a));
    // با برداشتن یک مقدار والد (مثلاً برند)، مقدارهای فرزند (مدل‌ها) هم برداشته می‌شوند
    if (on) {
      const childAttrs = attributes.filter((x) => x.parent_attribute_id === attrId).map((x) => x.id);
      for (const a of next) if (childAttrs.includes(a.attribute_id)) a.term_ids = a.term_ids.filter((tid) => termById.get(tid)?.parent_term_id !== termId);
    }
    upd({ attributes: next });
  };
  const setAllTerms = (attrId: number, terms: number[]) => setAttr(attrId, { term_ids: terms });

  /* ───── متغیرها ───── */
  const termNames = useCallback((attrs: Record<string, string>) => {
    const out: { name: string; color?: string }[] = [];
    for (const pa of p.attributes) {
      const a = attrById.get(pa.attribute_id)!;
      const slug = attrs[a.slug];
      if (!slug) continue;
      const t = a.terms.find((x) => x.slug === slug);
      if (t) out.push({ name: t.name, color: a.type === 'color' ? t.value ?? undefined : undefined });
    }
    return out;
  }, [p.attributes, attrById]);

  const generate = () => {
    if (!varAttrs.length) { adminToast('ابتدا یک ویژگی اضافه کنید و مقدارهایش را انتخاب کنید', 'err'); return; }
    const gen: GenAttr[] = varAttrs.map((pa) => {
      const a = attrById.get(pa.attribute_id)!;
      return { id: a.id, slug: a.slug, parent_attribute_id: a.parent_attribute_id, terms: a.terms.filter((t) => pa.term_ids.includes(t.id)).map((t) => ({ id: t.id, slug: t.slug, parent_term_id: t.parent_term_id })) };
    });
    const combos = generateCombos(gen);
    if (combos.length > 300) { adminToast(`${fa(combos.length)} ترکیب ساخته می‌شود؛ حداکثر ۳۰۰ متغیر مجاز است. مقدارها را کمتر کنید.`, 'err'); return; }
    const existing = new Map(p.variations.map((v) => [attrsKey(v.attrs), v]));
    const keys = new Set(combos.map(attrsKey));
    const removed = p.variations.filter((v) => !keys.has(attrsKey(v.attrs))).length;
    let added = 0;
    const next = combos.map((c) => {
      const old = existing.get(attrsKey(c));
      if (old) return { ...old, attrs: c };
      added++;
      return { id: null, attrs: c, sku: '', price: newPrice, sale_price: null, stock: 0, image: null, status: 'active' as const };
    });
    upd({ variations: next });
    adminToast(`${fa(next.length)} متغیر آماده است (${fa(added)} جدید${removed ? `، ${fa(removed)} نامعتبر حذف شد` : ''}). قیمت و موجودی را کامل کنید.`);
  };
  const setVar = (key: string, patch: Partial<ProductPayload['variations'][number]>) =>
    upd({ variations: p.variations.map((v) => (attrsKey(v.attrs) === key ? { ...v, ...patch } : v)) });

  const shown = p.variations.filter((v) => !vFilter.trim() || termNames(v.attrs).map((t) => t.name).join(' ').toLowerCase().includes(vFilter.trim().toLowerCase()));
  const applyBulk = (fn: (v: ProductPayload['variations'][number]) => Partial<ProductPayload['variations'][number]>) => {
    const keys = new Set(shown.map((v) => attrsKey(v.attrs)));
    upd({ variations: p.variations.map((v) => (keys.has(attrsKey(v.attrs)) ? { ...v, ...fn(v) } : v)) });
    adminToast(`روی ${fa(keys.size)} متغیر اعمال شد`);
  };

  /* ───── ذخیره ───── */
  const save = () => {
    setErrors(null);
    startSave(async () => {
      const r = await saveProduct(p);
      if (r.error) { setErrors(r.error); adminToast(r.error, 'err'); return; }
      adminToast(r.ok || 'ذخیره شد');
      setDirty(false);
      if (isNew && r.id) router.replace(`/admin/products/${r.id}`);
      else router.refresh();
    });
  };

  const price = p.price, sale = p.sale_price;
  const off = price && sale && sale < price ? Math.round((1 - sale / price) * 100) : 0;
  const varCount = p.variations.length;
  const activeVars = p.variations.filter((v) => v.status === 'active').length;
  const missingPrice = p.variations.filter((v) => v.status === 'active' && !v.price).length;

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) upload(e.target.files, (urls) => upd({ images: [...p.images, ...urls] })); e.target.value = ''; }} />
      <div className="ad-cols">
        <div className="ad-stack">
          {errors && <div className="alert err" role="alert">{errors}</div>}

          <section className="ad-card">
            <div className="hd"><h2>اطلاعات اصلی</h2></div>
            <div className="bd">
              <div className="fld">
                <label htmlFor="pname">نام محصول</label>
                <input id="pname" className="input" value={p.name} placeholder="مثلاً: قاب سیلیکونی MagSafe" maxLength={160}
                  onChange={(e) => { upd({ name: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) }); }} />
              </div>
              <div className="fld">
                <label htmlFor="pslug">نشانی صفحه (slug)</label>
                <input id="pslug" className="input" dir="ltr" value={p.slug} onChange={(e) => { setSlugTouched(true); upd({ slug: e.target.value }); }} />
                <span className="help" dir="ltr" style={{ textAlign: 'right' }}>/product/{p.slug || '…'}</span>
              </div>
              <div className="fld">
                <label htmlFor="pshort">توضیح کوتاه</label>
                <input id="pshort" className="input" value={p.short_desc} maxLength={300} onChange={(e) => upd({ short_desc: e.target.value })} placeholder="یک یا دو جمله برای زیر عنوان صفحه‌ی محصول" />
              </div>
              <div className="fld">
                <label htmlFor="pdesc">توضیحات کامل</label>
                <textarea id="pdesc" className="textarea" style={{ minHeight: 140 }} value={p.description} onChange={(e) => upd({ description: e.target.value })} />
                <span className="help">برای پاراگراف جدید یک خط خالی بگذارید.</span>
              </div>
            </div>
          </section>

          <section className="ad-card">
            <div className="hd"><h2>تصاویر محصول</h2><p>اولین تصویر، تصویر اصلی است. تصویر با زمینه‌ی روشن یا شفاف (PNG/WebP) بهترین نتیجه را می‌دهد؛ نسبت ۱:۱ پیشنهاد می‌شود.</p></div>
            <div className="bd">
              {p.images.length > 0 && (
                <div className="imgs">
                  {p.images.map((src, i) => (
                    <div className="im" key={src + i}>
                      {i === 0 && <span className="tag">اصلی</span>}
                      <Pic src={src} />
                      <div className="ctl">
                        <button type="button" onClick={() => moveImg(i, 1)} disabled={i === p.images.length - 1} aria-label="انتقال به چپ"><ArrowLeft /></button>
                        <button type="button" onClick={() => upd({ images: [src, ...p.images.filter((_, k) => k !== i)] })} aria-label="تصویر اصلی"><Star /></button>
                        <button type="button" onClick={() => moveImg(i, -1)} disabled={i === 0} aria-label="انتقال به راست"><ArrowRight /></button>
                        <button type="button" onClick={() => upd({ images: p.images.filter((_, k) => k !== i) })} aria-label="حذف تصویر"><Trash2 /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div
                className="drop" role="button" tabIndex={0} onClick={() => fileRef.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('over'); }} onDragLeave={(e) => e.currentTarget.classList.remove('over')}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('over'); upload(e.dataTransfer.files, (urls) => upd({ images: [...p.images, ...urls] })); }}
              >
                <Upload />
                <b style={{ color: 'var(--ink)' }}>{uploading ? 'در حال آپلود…' : 'تصویر را بکشید و رها کنید یا کلیک کنید'}</b>
                <small>JPG، PNG، WebP یا AVIF · حداکثر ۶ مگابایت برای هر تصویر</small>
              </div>
              <details>
                <summary style={{ cursor: 'pointer', color: 'var(--action)', fontWeight: 600, fontSize: 13 }}>استفاده از تصویر نمونه (تا زمان آماده شدن عکس واقعی)</summary>
                <div className="tchips" style={{ marginTop: 10 }}>
                  {ART_KEYS.map((k) => (
                    <button type="button" key={k} className="tchip" onClick={() => upd({ images: [...p.images, `art:${k}`] })}><span style={{ width: 22, height: 22, display: 'inline-block' }}><Pic src={`art:${k}`} /></span>{ART_LABELS[k]}</button>
                  ))}
                </div>
              </details>
            </div>
          </section>

          <section className="ad-card">
            <div className="hd"><h2>نوع محصول</h2></div>
            <div className="bd">
              <div className="seg" role="group" aria-label="نوع محصول">
                <button type="button" aria-pressed={p.type === 'simple'} onClick={() => upd({ type: 'simple' })}>محصول ساده</button>
                <button type="button" aria-pressed={p.type === 'variable'} onClick={() => upd({ type: 'variable' })}><Layers style={{ width: 15 }} />محصول متغیر</button>
              </div>
              <div className="ad-note"><Info /><div>
                {p.type === 'simple'
                  ? <><b>محصول ساده</b> یک قیمت و یک موجودی دارد؛ مثل شارژر یا پاوربانک.</>
                  : <><b>محصول متغیر</b> گونه‌های مختلف دارد؛ مثل قاب که برای هر <b>برند گوشی</b>، <b>مدل</b> و <b>رنگ</b> قیمت و موجودی جدا دارد. ویژگی‌ها را انتخاب کنید، «ساخت متغیرها» را بزنید و قیمت و موجودی هر گونه را وارد کنید.</>}
              </div></div>
            </div>
          </section>

          {p.type === 'simple' ? (
            <section className="ad-card">
              <div className="hd"><h2>قیمت و موجودی</h2></div>
              <div className="bd">
                <div className="ad-grid2">
                  <div className="fld"><label htmlFor="pprice">قیمت (تومان)</label><Money id="pprice" value={p.price} onChange={(v) => upd({ price: v })} /></div>
                  <div className="fld"><label htmlFor="psale">قیمت با تخفیف (اختیاری)</label><Money id="psale" value={p.sale_price} onChange={(v) => upd({ sale_price: v })} />
                    {off > 0 && <span className="help" style={{ color: 'var(--sale)' }}>{fa(off)}٪ تخفیف</span>}
                    {sale && price && sale >= price ? <span className="error">قیمت تخفیفی باید از قیمت اصلی کمتر باشد</span> : null}
                  </div>
                  <div className="fld"><label htmlFor="pstock">موجودی انبار</label><input id="pstock" className="input num" inputMode="numeric" value={p.stock ? fa(p.stock) : p.stock === 0 ? '۰' : ''} onChange={(e) => upd({ stock: Number(e.target.value.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\D/g, '') || 0) })} /></div>
                  <div className="fld"><label htmlFor="psku">کد محصول (SKU)</label><input id="psku" className="input" dir="ltr" value={p.sku} onChange={(e) => upd({ sku: e.target.value })} /></div>
                </div>
              </div>
            </section>
          ) : (
            <>
              <section className="ad-card">
                <div className="hd"><h2>۱. ویژگی‌های محصول</h2><p>ویژگی‌هایی را که این محصول دارد اضافه کنید و مقدارهای مجازش را تیک بزنید. «مدل گوشی» فقط مدل‌های برندهای انتخاب‌شده را نشان می‌دهد.</p></div>
                <div className="bd">
                  {p.attributes.map((pa) => {
                    const a = attrById.get(pa.attribute_id)!;
                    const parentOnProduct = a.parent_attribute_id ? p.attributes.find((x) => x.attribute_id === a.parent_attribute_id) : undefined;
                    const parentAttr = a.parent_attribute_id ? attrById.get(a.parent_attribute_id) : undefined;
                    // گروه‌بندی مقدارها بر اساس والد
                    const groups: { label?: string; terms: EdAttribute['terms'] }[] = [];
                    if (parentAttr) {
                      for (const pt of parentAttr.terms) {
                        if (parentOnProduct && !parentOnProduct.term_ids.includes(pt.id)) continue;
                        const ts = a.terms.filter((t) => t.parent_term_id === pt.id);
                        if (ts.length) groups.push({ label: pt.name, terms: ts });
                      }
                      const orphan = a.terms.filter((t) => !t.parent_term_id);
                      if (orphan.length) groups.push({ label: undefined, terms: orphan });
                    } else groups.push({ terms: a.terms });
                    const visible = groups.flatMap((g) => g.terms.map((t) => t.id));
                    return (
                      <div className="attr-card" key={pa.attribute_id}>
                        <div className="hd">
                          <b>{a.name}</b>
                          <span className="mute num" style={{ fontSize: 12 }}>{fa(pa.term_ids.length)} مقدار انتخاب شده</span>
                          <span className="sp" />
                          <label className="switch" style={{ fontSize: 13 }}><input type="checkbox" checked={pa.for_variations} onChange={(e) => setAttr(pa.attribute_id, { for_variations: e.target.checked })} /><span className="tr" /><span>برای ساخت متغیر</span></label>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAllTerms(pa.attribute_id, visible)}>همه</button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAllTerms(pa.attribute_id, [])}>هیچ</button>
                          <button type="button" className="icon-btn" onClick={() => upd({ attributes: p.attributes.filter((x) => x.attribute_id !== pa.attribute_id) })} aria-label={`حذف ویژگی ${a.name}`}><X className="i" /></button>
                        </div>
                        <div className="bd">
                          {parentAttr && !parentOnProduct && <div className="ad-note warn"><Info /><div>برای نمایش درست «{a.name}» بهتر است ابتدا ویژگی «{parentAttr.name}» را هم اضافه کنید.</div></div>}
                          {parentAttr && parentOnProduct && groups.length === 0 && <span className="mute">ابتدا مقدارهای «{parentAttr.name}» را در بالا انتخاب کنید.</span>}
                          {groups.map((g, gi) => (
                            <div className="tgroup" key={gi}>
                              {g.label && <small>{g.label}</small>}
                              <div className="tchips">
                                {g.terms.map((t) => {
                                  const on = pa.term_ids.includes(t.id);
                                  return (
                                    <label key={t.id} className={`tchip${on ? ' on' : ''}`}>
                                      <input type="checkbox" className="sr" checked={on} onChange={() => toggleTerm(pa.attribute_id, t.id)} />
                                      {a.type === 'color' && <i style={{ background: t.value ?? '#ccc' }} />}{t.name}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                          {a.terms.length === 0 && <span className="mute">این ویژگی هنوز مقداری ندارد. <Link className="link" href={`/admin/attributes/${a.id}`} target="_blank">افزودن مقدار</Link></span>}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select className="sel" style={{ width: 'auto', minWidth: 200 }} value="" onChange={(e) => { const id = Number(e.target.value); if (id) upd({ attributes: [...p.attributes, { attribute_id: id, term_ids: [], for_variations: true }] }); }} aria-label="افزودن ویژگی">
                      <option value="">+ افزودن ویژگی…</option>
                      {available.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <Link className="link" href="/admin/attributes" target="_blank" style={{ fontSize: 13 }}>ساخت ویژگی جدید</Link>
                    {p.attributes.length === 0 && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                        const want = ['phone-brand', 'phone-model', 'color'].map((s) => attributes.find((a) => a.slug === s)).filter(Boolean) as EdAttribute[];
                        if (want.length) upd({ attributes: want.map((a) => ({ attribute_id: a.id, term_ids: [], for_variations: true })) });
                      }}><Sparkles />ویژگی‌های پیشنهادی (برند، مدل، رنگ)</button>
                    )}
                  </div>
                </div>
              </section>

              <section className="ad-card">
                <div className="hd">
                  <h2>۲. متغیرها (قیمت و موجودی هر گونه)</h2>
                  <span className="mute num" style={{ fontSize: 13 }}>{fa(varCount)} متغیر · {fa(activeVars)} فعال</span>
                  <p>پس از انتخاب مقدارها، دکمه‌ی «ساخت متغیرها» همه‌ی ترکیب‌های معتبر را می‌سازد. متغیرهای قبلی و قیمت‌هایشان حفظ می‌شوند.</p>
                </div>
                <div className="bulkbar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label htmlFor="newprice" style={{ fontSize: 12.5, fontWeight: 600 }}>قیمت پیش‌فرض متغیرهای جدید</label>
                    <span style={{ width: 130 }}><Money id="newprice" value={newPrice} onChange={setNewPrice} placeholder="تومان" /></span>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={generate}><Wand2 />ساخت متغیرها</button>
                </div>
                {varCount === 0 ? (
                  <div className="ad-empty"><Layers /><h3>هنوز متغیری ساخته نشده</h3><p>ویژگی‌ها را انتخاب کنید و دکمه‌ی «ساخت متغیرها» را بزنید.</p></div>
                ) : (
                  <>
                    <div className="bulkbar" aria-label="عملیات گروهی">
                      <input className="input" placeholder="فیلتر متغیرها…" value={vFilter} onChange={(e) => setVFilter(e.target.value)} aria-label="فیلتر متغیرها" style={{ width: 160 }} />
                      <span style={{ display: 'inline-flex', gap: 4 }}><span style={{ width: 120 }}><Money value={bulk.price} onChange={(v) => setBulk((b) => ({ ...b, price: v }))} placeholder="قیمت" /></span><button type="button" className="btn btn-secondary btn-sm" disabled={!bulk.price} onClick={() => applyBulk(() => ({ price: bulk.price }))}>ثبت قیمت</button></span>
                      <span style={{ display: 'inline-flex', gap: 4 }}><input className="input num" inputMode="numeric" placeholder="موجودی" value={bulk.stock === null ? '' : fa(bulk.stock)} onChange={(e) => setBulk((b) => ({ ...b, stock: e.target.value ? Number(e.target.value.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\D/g, '') || 0) : null }))} style={{ width: 90 }} /><button type="button" className="btn btn-secondary btn-sm" disabled={bulk.stock === null} onClick={() => applyBulk(() => ({ stock: bulk.stock }))}>ثبت موجودی</button></span>
                      <span style={{ display: 'inline-flex', gap: 4 }}><input className="input num" inputMode="numeric" placeholder="٪ تخفیف" value={bulk.pct} onChange={(e) => setBulk((b) => ({ ...b, pct: e.target.value.replace(/\D/g, '').slice(0, 2) }))} style={{ width: 90 }} /><button type="button" className="btn btn-secondary btn-sm" disabled={!bulk.pct} onClick={() => { const k = 100 - Number(bulk.pct); applyBulk((v) => ({ sale_price: v.price ? Math.floor((v.price * k) / 100 / 1000) * 1000 || null : null })); }}>اعمال تخفیف</button></span>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyBulk(() => ({ sale_price: null }))}>حذف تخفیف‌ها</button>
                      <button type="button" className="btn btn-danger-soft btn-sm" onClick={() => { const keys = new Set(shown.map((v) => attrsKey(v.attrs))); upd({ variations: p.variations.filter((v) => !keys.has(attrsKey(v.attrs))) }); }}>حذف {vFilter ? 'نمایش‌داده‌شده‌ها' : 'همه'}</button>
                    </div>
                    {missingPrice > 0 && <div className="ad-note warn" style={{ margin: 12 }}><Info /><div>{fa(missingPrice)} متغیر فعال هنوز قیمت ندارد. بدون قیمت، محصول ذخیره نمی‌شود.</div></div>}
                    <div className="vars" style={{ border: 0, borderRadius: 0 }}>
                      <div className="vrow head" aria-hidden><span>گونه</span><span>قیمت (تومان)</span><span>قیمت تخفیفی</span><span>موجودی</span><span /></div>
                      {shown.map((v) => {
                        const key = attrsKey(v.attrs);
                        const names = termNames(v.attrs);
                        const colorHex = names.find((n) => n.color)?.color;
                        const art = parseArt(p.images[0]);
                        return (
                          <div key={key}>
                            <div className={`vrow${v.status === 'disabled' ? ' off' : ''}`}>
                              <div className="lbl">
                                <button type="button" className="vimg" onClick={() => setImgPick(imgPick === p.variations.indexOf(v) ? null : p.variations.indexOf(v))} aria-label="انتخاب تصویر این متغیر" title="تصویر متغیر">
                                  {v.image ? <Pic src={v.image} /> : <ImageIcon style={{ width: 16, color: 'var(--stone)' }} />}
                                </button>
                                {names.map((n, i) => <span key={i} dir="auto" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{n.color && <span className="sw" style={{ background: n.color }} />}{n.name}{i < names.length - 1 && <span className="mute"> ·</span>}</span>)}
                              </div>
                              <div data-l="قیمت"><Money value={v.price} onChange={(x) => setVar(key, { price: x })} /></div>
                              <div data-l="قیمت تخفیفی"><Money value={v.sale_price} onChange={(x) => setVar(key, { sale_price: x })} /></div>
                              <div data-l="موجودی"><input className="input num" inputMode="numeric" value={fa(v.stock ?? 0)} onChange={(e) => setVar(key, { stock: Number(e.target.value.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\D/g, '') || 0) })} aria-label="موجودی" /></div>
                              <div className="rowact">
                                <label className="switch" title="فعال/غیرفعال"><input type="checkbox" checked={v.status === 'active'} onChange={(e) => setVar(key, { status: e.target.checked ? 'active' : 'disabled' })} /><span className="tr" /><span className="sr">فعال</span></label>
                                <button type="button" className="icon-btn" onClick={() => upd({ variations: p.variations.filter((x) => attrsKey(x.attrs) !== key) })} aria-label="حذف متغیر"><Trash2 className="i" style={{ width: 17 }} /></button>
                              </div>
                            </div>
                            {imgPick === p.variations.indexOf(v) && (
                              <div style={{ padding: '10px 14px 14px', background: 'var(--parchment)', borderBottom: '1px solid var(--hairline)' }}>
                                <div className="tchips">
                                  <button type="button" className={`tchip${!v.image ? ' on' : ''}`} onClick={() => { setVar(key, { image: null }); setImgPick(null); }}>بدون تصویر اختصاصی</button>
                                  {p.images.map((src, i) => <button type="button" key={i} className={`tchip${v.image === src ? ' on' : ''}`} onClick={() => { setVar(key, { image: src }); setImgPick(null); }}><span style={{ width: 22, height: 22, display: 'inline-block' }}><Pic src={src} /></span>تصویر {fa(i + 1)}</button>)}
                                  {art && colorHex && <button type="button" className="tchip" onClick={() => { setVar(key, { image: `art:${art.key}@${colorHex}` }); setImgPick(null); }}><i style={{ background: colorHex }} />تصویر نمونه با این رنگ</button>}
                                  <button type="button" className="tchip" onClick={() => { vFileRef.current?.setAttribute('data-key', key); vFileRef.current?.click(); }}><Upload style={{ width: 14 }} />آپلود تصویر جدید</button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {shown.length === 0 && <div className="ad-empty"><p>متغیری با این فیلتر پیدا نشد</p></div>}
                    </div>
                    <input ref={vFileRef} type="file" accept="image/*" hidden onChange={(e) => {
                      const key = e.target.getAttribute('data-key');
                      if (e.target.files?.length && key) upload(e.target.files, (urls) => { setVar(key, { image: urls[0] }); setImgPick(null); });
                      e.target.value = '';
                    }} />
                  </>
                )}
              </section>
            </>
          )}

          <section className="ad-card">
            <div className="hd"><h2>مشخصات فنی</h2><p>در تب مشخصات صفحه‌ی محصول نمایش داده می‌شود (مثل جنس، توان، گارانتی).</p></div>
            <div className="bd">
              {p.specs.map((s, i) => (
                <div className="specrow" key={i}>
                  <input className="input" placeholder="عنوان (مثلاً جنس)" value={s.k} onChange={(e) => upd({ specs: p.specs.map((x, k) => (k === i ? { ...x, k: e.target.value } : x)) })} aria-label="عنوان مشخصه" />
                  <input className="input" placeholder="مقدار" value={s.v} onChange={(e) => upd({ specs: p.specs.map((x, k) => (k === i ? { ...x, v: e.target.value } : x)) })} aria-label="مقدار مشخصه" />
                  <button type="button" className="icon-btn" onClick={() => upd({ specs: p.specs.filter((_, k) => k !== i) })} aria-label="حذف ردیف"><X className="i" /></button>
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" style={{ width: 'fit-content' }} onClick={() => upd({ specs: [...p.specs, { k: '', v: '' }] })}><Plus />افزودن مشخصه</button>
            </div>
          </section>
        </div>

        <aside className="ad-stack ad-sticky">
          <section className="ad-card">
            <div className="hd"><h2>انتشار</h2></div>
            <div className="bd">
              <div className="fld">
                <span className="lab">وضعیت</span>
                <div className="seg" role="group" aria-label="وضعیت انتشار">
                  <button type="button" aria-pressed={p.status === 'published'} onClick={() => upd({ status: 'published' })}>منتشر شده</button>
                  <button type="button" aria-pressed={p.status === 'draft'} onClick={() => upd({ status: 'draft' })}>پیش‌نویس</button>
                </div>
                <span className="help">پیش‌نویس در سایت نمایش داده نمی‌شود.</span>
              </div>
              <label className="switch"><input type="checkbox" checked={p.featured} onChange={(e) => upd({ featured: e.target.checked })} /><span className="tr" /><span>محصول ویژه (صفحه اصلی)</span></label>
              <div className="fld">
                <label htmlFor="pbadge">نشان روی کارت</label>
                <select id="pbadge" className="sel" value={p.badge ?? ''} onChange={(e) => upd({ badge: (e.target.value || null) as ProductPayload['badge'] })}>
                  <option value="">خودکار (جدید برای ۱۴ روز اول)</option>
                  <option value="new">جدید</option><option value="best">پرفروش</option><option value="promo">تخفیف ویژه</option>
                </select>
              </div>
            </div>
          </section>
          <section className="ad-card">
            <div className="hd"><h2>دسته‌بندی و برند</h2></div>
            <div className="bd">
              <div className="fld">
                <label htmlFor="pcat">دسته‌بندی</label>
                <select id="pcat" className="sel" value={p.category_id ?? ''} onChange={(e) => upd({ category_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">بدون دسته</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{'— '.repeat(c.depth)}{c.name}</option>)}
                </select>
              </div>
              <div className="fld">
                <label htmlFor="pbrand">برند</label>
                <select id="pbrand" className="sel" value={p.brand_id ?? ''} onChange={(e) => upd({ brand_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">بدون برند</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              {p.type === 'variable' && <div className="fld"><label htmlFor="psku2">کد پایه (SKU)</label><input id="psku2" className="input" dir="ltr" value={p.sku} onChange={(e) => upd({ sku: e.target.value })} /></div>}
            </div>
          </section>
          {p.type === 'variable' && varCount > 0 && (
            <section className="ad-card"><div className="bd">
              <div className="mute" style={{ fontSize: 13 }}>محدوده‌ی قیمت</div>
              {(() => { const ps = p.variations.filter((v) => v.status === 'active' && v.price).map((v) => (v.sale_price && v.price && v.sale_price < v.price ? v.sale_price : v.price!)); return ps.length ? <b className="num" style={{ fontSize: 16, color: 'var(--ink)' }}>{toman(Math.min(...ps))} تا {toman(Math.max(...ps))} تومان</b> : <span className="mute">—</span>; })()}
              <div className="mute" style={{ fontSize: 13 }}>موجودی کل: <b className="num" style={{ color: 'var(--ink)' }}>{fa(p.variations.filter((v) => v.status === 'active').reduce((s, v) => s + (v.stock ?? 0), 0))}</b></div>
            </div></section>
          )}
        </aside>
      </div>

      <div className="ad-savebar">
        <button type="button" className="btn btn-primary btn-lg" onClick={save} disabled={saving}>{saving ? 'در حال ذخیره…' : isNew ? 'ساخت محصول' : 'ذخیره‌ی تغییرات'}</button>
        {!isNew && p.slug && <Link className="btn btn-secondary btn-lg" href={`/product/${encodeURIComponent(p.slug)}`} target="_blank"><Eye /><span className="lbl-d">مشاهده در سایت</span></Link>}
        <Link className="btn btn-secondary btn-lg" href="/admin/products" aria-label="بازگشت"><ArrowRight /><span className="lbl-d">بازگشت</span></Link>
        {dirty && <span className="dirty">تغییرات ذخیره‌نشده</span>}
      </div>
    </div>
  );
}
