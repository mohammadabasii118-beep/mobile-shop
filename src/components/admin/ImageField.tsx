'use client';

import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { adminToast } from './client';
import Pic from '../shop/Pic';

/** آپلود یک تصویر؛ مقدار در input مخفی با نام `name` ثبت می‌شود */
export default function ImageField({ name, defaultValue, label, hint, onChange, aspect = '16 / 9' }: { name: string; defaultValue?: string | null; label: string; hint?: string; onChange?: (v: string) => void; aspect?: string }) {
  const [v, setV] = useState(defaultValue ?? '');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const set = (x: string) => { setV(x); onChange?.(x); };
  const upload = async (f: File) => {
    setBusy(true);
    try {
      const fd = new FormData(); fd.append('file', f);
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'آپلود انجام نشد');
      set(j.urls[0]);
    } catch (e) { adminToast(e instanceof Error ? e.message : 'آپلود انجام نشد', 'err'); } finally { setBusy(false); }
  };
  return (
    <div className="fld">
      <span className="lab">{label}</span>
      <input type="hidden" name={name} value={v} />
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      {v ? (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: 'var(--studio)', aspectRatio: aspect, display: 'grid', placeItems: 'center', boxShadow: 'inset 0 0 0 1px var(--hairline)' }}>
          <Pic src={v} className="" />
          <style>{`.fld img{max-width:100%;max-height:100%;object-fit:contain}`}</style>
          <button type="button" className="icon-btn" style={{ position: 'absolute', top: 6, insetInlineEnd: 6, background: 'var(--canvas)' }} onClick={() => set('')} aria-label="حذف تصویر"><X className="i" /></button>
        </div>
      ) : (
        <button type="button" className="drop" onClick={() => ref.current?.click()} disabled={busy}><ImagePlus /><b style={{ color: 'var(--ink)' }}>{busy ? 'در حال آپلود…' : 'انتخاب تصویر'}</b></button>
      )}
      {v && <button type="button" className="link" style={{ width: 'fit-content', fontSize: 13 }} onClick={() => ref.current?.click()}>{busy ? 'در حال آپلود…' : 'تغییر تصویر'}</button>}
      {hint && <span className="help">{hint}</span>}
    </div>
  );
}
