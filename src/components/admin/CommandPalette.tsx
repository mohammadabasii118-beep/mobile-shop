'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, FileText, Package, ShoppingCart, User } from 'lucide-react';
import type { NavGroup } from './AdminNav';
import { normText } from '@/lib/format';

type Hit = { type: 'product' | 'order' | 'user'; title: string; sub: string; href: string };

export default function CommandPalette({ groups, onClose }: { groups: NavGroup[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [i, setI] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  const pages = useMemo(() => {
    const base = groups.flatMap((g) => g.items.map((it) => ({ title: it.label, sub: g.title, href: it.href, k: `${it.label} ${it.keywords ?? ''}` })));
    return [
      ...base,
      { title: 'افزودن محصول جدید', sub: 'میان‌بر', href: '/admin/products/new', k: 'محصول جدید افزودن ساخت' },
      { title: 'افزودن بنر جدید', sub: 'میان‌بر', href: '/admin/banners/new', k: 'بنر اسلایدر هیرو جدید' },
      { title: 'ساخت کد تخفیف', sub: 'میان‌بر', href: '/admin/coupons', k: 'کوپن کد تخفیف' },
      { title: 'ویژگی جدید (رنگ، مدل گوشی …)', sub: 'میان‌بر', href: '/admin/attributes', k: 'ویژگی رنگ مدل گوشی متغیر' },
    ];
  }, [groups]);

  const term = normText(q).toLowerCase();
  const pageHits = term ? pages.filter((p) => normText(p.k).toLowerCase().includes(term)) : pages.slice(0, 8);

  useEffect(() => { input.current?.focus(); const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  useEffect(() => {
    if (term.length < 2) { setHits([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => fetch(`/api/admin/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal }).then((r) => r.json()).then(setHits).catch(() => {}), 160);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [term]);

  const all = [...pageHits.map((p) => ({ ...p, kind: 'page' as const })), ...hits.map((h) => ({ title: h.title, sub: h.sub, href: h.href, kind: h.type }))];
  const go = (href: string) => { onClose(); router.push(href); };
  const Ico = (k: string) => (k === 'product' ? Package : k === 'order' ? ShoppingCart : k === 'user' ? User : FileText);

  return (
    <div className="cmd-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label="جستجوی سریع">
      <div className="cmd">
        <input
          ref={input} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} placeholder="شماره سفارش، نام محصول، نام مشتری یا نام صفحه…" aria-label="جستجو"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(all.length - 1, x + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
            if (e.key === 'Enter' && all[i]) go(all[i].href);
          }}
        />
        <ul role="listbox">
          {all.length === 0 && <li style={{ padding: 20, color: 'var(--mute)', textAlign: 'center' }}>نتیجه‌ای پیدا نشد</li>}
          {all.map((a, idx) => {
            const Icon = Ico(a.kind);
            return (
              <li key={a.kind + a.href + idx}>
                <a href={a.href} role="option" aria-selected={idx === i} onClick={(e) => { e.preventDefault(); go(a.href); }} onMouseEnter={() => setI(idx)}>
                  <Icon aria-hidden /><span>{a.title}</span><small>{a.sub}</small>{idx === i && <CornerDownLeft style={{ width: 14 }} aria-hidden />}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
