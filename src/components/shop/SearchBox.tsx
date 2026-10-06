'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search } from 'lucide-react';
import Pic from './Pic';
import { toman } from '@/lib/format';

type S = { name: string; slug: string; brand: string | null; image: string | null; price: number };

export default function SearchBox({ mobile = false }: { mobile?: boolean }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<S[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setItems([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => r.json()).then((d) => { setItems(d); setActive(-1); }).catch(() => {});
    }, 180);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  useEffect(() => {
    const out = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, []);

  useEffect(() => {
    if (mobile) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === '/' && !/input|textarea|select/i.test((document.activeElement as HTMLElement)?.tagName || '')) { e.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [mobile]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);
    if (active >= 0 && items[active]) router.push(`/product/${encodeURIComponent(items[active].slug)}`);
    else if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); setOpen(true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    else if (e.key === 'Escape') setOpen(false);
  };

  const body = (
    <div ref={box} className={mobile ? undefined : 'search-wrap'} style={mobile ? { position: 'relative' } : undefined}>
      <form className="search" role="search" onSubmit={submit}>
        <Search className="i" aria-hidden />
        <input
          ref={input} type="search" name="q" value={q} placeholder="جستجوی قاب، شارژر، پاوربانک…" autoComplete="off" enterKeyHint="search"
          aria-label="جستجو در محصولات" aria-expanded={open && items.length > 0} aria-controls={id} aria-autocomplete="list"
          onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
        />
        {!mobile && <kbd aria-hidden>/</kbd>}
      </form>
      {open && items.length > 0 && (
        <div className="suggest" id={id} role="listbox">
          {items.map((p, i) => (
            <Link key={p.slug} href={`/product/${encodeURIComponent(p.slug)}`} role="option" aria-selected={i === active} onClick={() => setOpen(false)}>
              <span className="thumb"><Pic src={p.image} /></span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span className="sm num">{p.brand ? `${p.brand} · ` : ''}از {toman(p.price)} تومان</span>
              </span>
            </Link>
          ))}
          <Link className="all" href={`/search?q=${encodeURIComponent(q.trim())}`} onClick={() => setOpen(false)}>مشاهده‌ی همه‌ی نتایج</Link>
        </div>
      )}
    </div>
  );
  return body;
}
