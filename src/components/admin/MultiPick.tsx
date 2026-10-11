'use client';

import { useState } from 'react';
import { Star, X } from 'lucide-react';

type Opt = { id: number; name: string; depth?: number };

/** انتخاب چندتایی با چیپ؛ اولین مورد «اصلی» است (DESIGN.md §۱۸.۱۰) */
export default function MultiPick({ label, options, value, onChange, none }: { label: string; options: Opt[]; value: number[]; onChange: (ids: number[]) => void; none: string }) {
  const [q, setQ] = useState('');
  const name = (id: number) => options.find((o) => o.id === id)?.name ?? '؟';
  const shown = q.trim() ? options.filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase())) : options;
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="mp">
      <span className="mp-label">{label}</span>
      <div className="mp-chips" aria-live="polite">
        {value.length === 0 && <span className="mute" style={{ fontSize: 13 }}>{none}</span>}
        {value.map((id, i) => (
          <span className="mp-chip" key={id}>
            {name(id)}
            {i === 0 && value.length > 1 && <b className="mp-main">اصلی</b>}
            {i > 0 && <button type="button" onClick={() => onChange([id, ...value.filter((x) => x !== id)])} aria-label={`اصلی کردن ${name(id)}`} title="اصلی کن"><Star className="i" style={{ width: 14, height: 14 }} /></button>}
            <button type="button" onClick={() => toggle(id)} aria-label={`حذف ${name(id)}`}><X className="i" style={{ width: 14, height: 14 }} /></button>
          </span>
        ))}
      </div>
      {options.length > 8 && <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو…" aria-label={`جستجو در ${label}`} />}
      <div className="mp-list" role="group" aria-label={label}>
        {shown.map((o) => (
          <label className="mp-opt" key={o.id} style={{ paddingInlineStart: 10 + (o.depth ?? 0) * 16 }}>
            <input type="checkbox" checked={value.includes(o.id)} onChange={() => toggle(o.id)} />
            <span>{o.name}</span>
          </label>
        ))}
        {shown.length === 0 && <span className="mute" style={{ padding: 10, fontSize: 13 }}>موردی پیدا نشد</span>}
      </div>
    </div>
  );
}
