'use client';

import { useState } from 'react';
import { Check, Tags } from 'lucide-react';
import { fa } from '@/lib/format';
import Money from './Money';

export type PriceGroup = { slug: string; name: string; terms: { slug: string; name: string; color?: string; count: number }[] };
export type GroupRow = { slug: string; term: string; price: number | null; sale: number | null; stock: number | null };
type Vals = { price: number | null; sale: number | null; stock: number | null };
const EMPTY: Vals = { price: null, sale: null, stock: null };

/** قیمت‌گذاری گروهی بر اساس یک ویژگی (DESIGN.md §۱۸.۱۱) */
export default function GroupPricing({ groups, onApply }: { groups: PriceGroup[]; onApply: (rows: GroupRow[]) => void }) {
  const [slug, setSlug] = useState(groups.find((g) => g.slug === 'phone-brand')?.slug ?? groups[0]?.slug ?? '');
  const [vals, setVals] = useState<Record<string, Vals>>({});
  const g = groups.find((x) => x.slug === slug) ?? groups[0];
  if (!g) return null;
  const key = (t: string) => `${g.slug}:${t}`;
  const get = (t: string) => vals[key(t)] ?? EMPTY;
  const set = (t: string, patch: Partial<Vals>) => setVals((v) => ({ ...v, [key(t)]: { ...get(t), ...patch } }));
  const row = (t: string): GroupRow => ({ slug: g.slug, term: t, ...get(t) });
  const filled = (t: string) => { const v = get(t); return v.price !== null || v.sale !== null || v.stock !== null; };
  const anyFilled = g.terms.some((t) => filled(t.slug));
  return (
    <div className="gp" role="group" aria-label="قیمت‌گذاری بر اساس ویژگی">
      <div className="gp-head">
        <b><Tags className="i" style={{ width: 16, height: 16 }} /> قیمت‌گذاری بر اساس ویژگی</b>
        <span className="mute">مثلاً برای هر برند یک قیمت بنویسید و «اعمال» بزنید. فیلد خالی تغییری نمی‌دهد.</span>
      </div>
      {groups.length > 1 && (
        <div className="tchips" role="radiogroup" aria-label="ویژگی گروه‌بندی">
          {groups.map((x) => (
            <button type="button" role="radio" aria-checked={x.slug === g.slug} key={x.slug} className={`tchip${x.slug === g.slug ? ' on' : ''}`} onClick={() => setSlug(x.slug)}>{x.name}</button>
          ))}
        </div>
      )}
      <div className="gp-rows">
        <div className="gp-row gp-h" aria-hidden><span>{g.name}</span><span>قیمت (تومان)</span><span>قیمت تخفیفی</span><span>موجودی</span><span /></div>
        {g.terms.map((t) => (
          <div className="gp-row" key={t.slug}>
            <span className="gp-name" dir="auto">{t.color && <i className="sw" style={{ background: t.color }} />}{t.name}<small className="mute num">{fa(t.count)} متغیر</small></span>
            <div data-l="قیمت"><Money value={get(t.slug).price} onChange={(v) => set(t.slug, { price: v })} placeholder="بدون تغییر" /></div>
            <div data-l="قیمت تخفیفی"><Money value={get(t.slug).sale} onChange={(v) => set(t.slug, { sale: v })} placeholder="بدون تغییر" /></div>
            <div data-l="موجودی">
              <input className="input num" inputMode="numeric" placeholder="بدون تغییر" value={get(t.slug).stock === null ? '' : fa(get(t.slug).stock!)}
                onChange={(e) => { const r = e.target.value.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\D/g, ''); set(t.slug, { stock: r ? Number(r) : null }); }} />
            </div>
            <button type="button" className="btn btn-secondary btn-sm" disabled={!filled(t.slug)} onClick={() => onApply([row(t.slug)])}>اعمال</button>
          </div>
        ))}
      </div>
      <div><button type="button" className="btn btn-primary btn-sm" disabled={!anyFilled} onClick={() => onApply(g.terms.filter((t) => filled(t.slug)).map((t) => row(t.slug)))}><Check />اعمال روی همه‌ی ردیف‌های پرشده</button></div>
    </div>
  );
}
