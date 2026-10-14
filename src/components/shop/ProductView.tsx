'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, Check, Minus, Plus, ShieldCheck, Smartphone, Truck, RotateCcw, TriangleAlert } from 'lucide-react';
import { fa, pct, toman } from '@/lib/format';
import { ATTR, effectivePrice, findVariation, optionState } from '@/lib/variations';
import Pic from './Pic';
import { useShop } from './CartProvider';

export type PVAttr = {
  slug: string;
  name: string;
  type: 'select' | 'color';
  parent: string | null; // slug ویژگی والد (برند ← مدل)
  terms: { slug: string; name: string; value: string | null; parent: string | null }[];
};
export type PVVariation = { id: number; attrs: Record<string, string>; price: number; sale_price: number | null; stock: number; image: string | null; status: string };
export type PVProps = {
  id: number;
  name: string;
  type: 'simple' | 'variable';
  images: string[];
  badge: { label: string; cls: string } | null;
  price: number;
  sale_price: number | null;
  stock: number;
  attrs: PVAttr[];
  variations: PVVariation[];
  low: number;
};

export default function ProductView({ header, ...p }: PVProps & { header: React.ReactNode }) {
  const { add, toast } = useShop();
  const [sel, setSel] = useState<Record<string, string | undefined>>({});
  const [qty, setQty] = useState(1);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(false);
  const [phone, setPhone] = useState<{ brand: string; model: string } | null>(null);
  const optsRef = useRef<HTMLDivElement>(null);
  const [nudge, setNudge] = useState(false);

  const variable = p.type === 'variable';
  const slugs = p.attrs.map((a) => a.slug);

  // پیش‌انتخاب: گوشی ذخیره‌شده‌ی مشتری + ویژگی‌هایی که فقط یک گزینه دارند
  useEffect(() => {
    if (!variable) return;
    let saved: { brand: string; model: string } | null = null;
    try { saved = JSON.parse(localStorage.getItem('vt_phone') || 'null'); } catch { /* noop */ }
    setPhone(saved);
    const init: Record<string, string> = {};
    const modelAttr = p.attrs.find((a) => a.slug === ATTR.model);
    if (saved && modelAttr?.terms.some((t) => t.slug === saved!.model)) {
      init[ATTR.model] = saved.model;
      const parent = modelAttr.terms.find((t) => t.slug === saved!.model)?.parent;
      if (parent) init[ATTR.brand] = parent;
    }
    for (const a of p.attrs) if (!init[a.slug] && a.terms.length === 1) init[a.slug] = a.terms[0].slug;
    setSel(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const variation = useMemo(() => (variable ? findVariation(p.variations, sel, slugs) : undefined), [variable, p.variations, sel, slugs]);

  const choose = (attr: PVAttr, term: string) => {
    setSel((cur) => {
      const next = { ...cur, [attr.slug]: term };
      // با تغییر والد، فرزندهای ناسازگار پاک می‌شوند
      for (const a of p.attrs) {
        if (a.parent === attr.slug && next[a.slug]) {
          const t = a.terms.find((x) => x.slug === next[a.slug]);
          if (t?.parent && t.parent !== next[attr.slug]) next[a.slug] = undefined;
        }
      }
      return next;
    });
    setPicked(false);
    setQty(1);
    if (attr.slug === ATTR.model) {
      const t = attr.terms.find((x) => x.slug === term);
      try { if (t) localStorage.setItem('vt_phone', JSON.stringify({ brand: t.parent ?? '', model: term })); } catch { /* noop */ }
      setPhone({ brand: t?.parent ?? '', model: term });
    }
  };

  /* قیمت و موجودی نمایش‌داده‌شده */
  const active = p.variations.filter((v) => v.status === 'active');
  const eff = (v: { price: number; sale_price: number | null }) => effectivePrice(v.price, v.sale_price);
  let price: number, old: number | null = null, prefix = false, stock: number;
  if (!variable) {
    price = effectivePrice(p.price, p.sale_price);
    old = price < p.price ? p.price : null;
    stock = p.stock;
  } else if (variation) {
    price = eff(variation);
    old = price < variation.price ? variation.price : null;
    stock = variation.stock;
  } else {
    const prices = active.map(eff);
    price = prices.length ? Math.min(...prices) : 0;
    prefix = prices.length > 1 && Math.max(...prices) !== price;
    stock = active.reduce((s, v) => s + v.stock, 0);
  }
  const off = old ? Math.round((1 - price / old) * 100) : 0;

  const missing = variable && !variation ? p.attrs.find((a) => !sel[a.slug]) : undefined;
  const soldOut = variable ? (variation ? variation.stock <= 0 : stock <= 0) : stock <= 0;
  const canBuy = (!variable || !!variation) && !soldOut;
  const max = Math.max(1, Math.min(99, (variable ? variation?.stock : stock) || 1));

  /* تصویر */
  const mainSrc = (!picked && variation?.image) || p.images[idx] || p.images[0] || null;
  const thumbs = p.images.length > 1 ? p.images : [];

  const submit = () => {
    if (variable && !variation) {
      setNudge(true);
      optsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setNudge(false), 1400);
      toast(missing ? `ابتدا «${missing.name}» را انتخاب کنید` : 'گزینه‌ها را انتخاب کنید', undefined, true);
      return;
    }
    if (soldOut) { toast('وقتی موجود شد خبرتان می‌کنیم'); return; }
    add({ productId: p.id, variationId: variation?.id ?? null, qty });
  };

  const modelAttr = p.attrs.find((a) => a.slug === ATTR.model);
  const savedModelName = phone && modelAttr?.terms.find((t) => t.slug === phone.model)?.name;
  const compatOk = !!variation && !!phone && sel[ATTR.model] === phone.model;
  const compatMissing = variable && !!phone && !!modelAttr && !modelAttr.terms.some((t) => t.slug === phone.model);

  const label = !variable || variation ? (soldOut ? 'خبرم کن' : 'افزودن به سبد خرید') : missing ? `انتخاب ${missing.name}` : 'انتخاب گزینه‌ها';

  return (
    <div className="pdp">
      <div className={`gallery${thumbs.length ? ' multi' : ''}`}>
        <div className="g-main">
          {p.badge && <span className={`badge ${p.badge.cls}`}>{p.badge.label}</span>}
          <Pic src={mainSrc} alt={p.name} eager sizes="(max-width: 900px) 100vw, 560px" />
        </div>
        {thumbs.length > 0 && (
          <div className="thumbs" role="group" aria-label="تصاویر محصول">
            {thumbs.map((src, i) => (
              <button key={i} className="thumb" aria-current={!picked ? (!variation?.image && idx === i) : idx === i} aria-label={`تصویر ${fa(i + 1)}`} onClick={() => { setIdx(i); setPicked(true); }}>
                <Pic src={src} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="buy">
        {header}

        <div className={`p-price${off ? ' off' : ''}`} aria-live="polite">
          {prefix && <span className="unit">از</span>}
          <span className="now num">{toman(price)}</span>
          <span className="unit">تومان</span>
          {old ? (
            <>
              <s className="num"><span className="sr">قیمت قبل از تخفیف: </span>{toman(old)}</s>
              <span className="pct">−{pct(off)}</span>
            </>
          ) : null}
        </div>

        {variable && (
          <div ref={optsRef} className="opt-wrap" style={{ display: 'grid', gap: 18, outline: nudge ? '2px solid var(--sale)' : 'none', outlineOffset: 8, borderRadius: 14, transition: 'outline-color .3s' }}>
            {p.attrs.map((a) => {
              const parentSel = a.parent ? sel[a.parent] : undefined;
              const parentAttr = a.parent ? p.attrs.find((x) => x.slug === a.parent) : undefined;
              const waiting = !!a.parent && !parentSel;
              const terms = a.terms.filter((t) => {
                if (!a.parent) return true;
                if (!parentSel) return false;
                return !t.parent || t.parent === parentSel;
              });
              const selectedName = a.terms.find((t) => t.slug === sel[a.slug])?.name;
              return (
                <div key={a.slug} className="opt-group" role="group" aria-label={a.name}>
                  <div className="lbl">{a.name}{selectedName && <small dir="auto">: {selectedName}</small>}{selectedName && terms.length > 1 && <button type="button" className="link" style={{ marginInlineStart: 'auto', fontSize: 12.5, fontWeight: 500 }} onClick={() => { setSel((c) => { const n = { ...c, [a.slug]: undefined }; for (const x of p.attrs) if (x.parent === a.slug) n[x.slug] = undefined; return n; }); setQty(1); }}>پاک کردن</button>}</div>
                  {waiting ? (
                    <div className="hint"><Smartphone className="i" style={{ width: 16, height: 16 }} />ابتدا «{parentAttr?.name}» را انتخاب کنید</div>
                  ) : (
                    <div className="opt-list">
                      {terms.map((t) => {
                        const state = optionState(p.variations, sel, a.slug, t.slug);
                        if (a.parent && state === 'unavailable') return null;
                        const on = sel[a.slug] === t.slug;
                        const cls = `${a.type === 'color' ? 'swatch' : 'opt-btn'}${state === 'soldout' ? ' soldout' : ''}${a.type !== 'color' && !/[A-Za-z]/.test(t.name) ? ' rtl' : ''}`;
                        return (
                          <button
                            key={t.slug} type="button" className={cls} aria-pressed={on} disabled={state === 'unavailable'}
                            aria-label={`${a.name}: ${t.name}${state === 'soldout' ? ' (ناموجود)' : ''}`} title={t.name} onClick={() => choose(a, t.slug)}
                          >
                            {a.type === 'color' ? <i style={{ background: t.value ?? '#ccc' }} /> : t.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {compatOk && <div className="compat"><Check className="i" />سازگار با گوشی شما: <bdi dir="ltr">{savedModelName}</bdi></div>}
        {compatMissing && <div className="hint warn"><TriangleAlert className="i" style={{ width: 16, height: 16 }} />این محصول برای مدل ذخیره‌شده‌ی شما (<bdi dir="ltr">{phone?.model}</bdi>) موجود نیست.</div>}

        <div>
          {(!variable || variation) && (
            <p className={`stock${soldOut ? ' out' : stock <= p.low ? ' low' : ''}`} style={{ marginBottom: 12 }}>
              {soldOut ? 'ناموجود' : stock <= p.low ? `تنها ${fa(stock)} عدد در انبار` : 'موجود در انبار'}
            </p>
          )}
          <div className="buy-row">
            {canBuy && (
              <div className="stepper" role="group" aria-label="تعداد">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="کاهش تعداد"><Minus className="i" /></button>
                <output className="num" aria-live="polite">{fa(qty)}</output>
                <button type="button" onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max} aria-label="افزایش تعداد"><Plus className="i" /></button>
              </div>
            )}
            <button type="button" className={`btn btn-lg ${canBuy ? 'btn-primary' : soldOut && (!variable || variation) ? 'btn-secondary' : 'btn-primary'}`} onClick={submit}>
              {soldOut && (!variable || variation) && <BellRing className="i" />}{label}
            </button>
          </div>
        </div>

        <div className="perks">
          <div><ShieldCheck className="i" />گارانتی اصالت و سلامت فیزیکی کالا</div>
          <div><Truck className="i" />ارسال سریع به سراسر کشور</div>
          <div><RotateCcw className="i" />۷ روز مهلت مرجوعی</div>
        </div>
      </div>

      {/* نوار خرید موبایل */}
      <div className="m-buybar">
        <div className="p">
          <b className="num">{prefix ? 'از ' : ''}{toman(price)} <small>تومان</small></b>
          {old ? <small className="num"><s>{toman(old)}</s></small> : <small>{!variable || variation ? (soldOut ? 'ناموجود' : 'موجود') : 'گزینه‌ها را انتخاب کنید'}</small>}
        </div>
        <button type="button" className="btn btn-primary" onClick={submit}>{label}</button>
      </div>
    </div>
  );
}
