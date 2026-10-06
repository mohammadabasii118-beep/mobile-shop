'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, AlertCircle } from 'lucide-react';
import { fa } from '@/lib/format';

export type StoredItem = { productId: number; variationId: number | null; qty: number };
type Toast = { id: number; msg: string; link?: { href: string; text: string }; err?: boolean };

type Ctx = {
  items: StoredItem[];
  count: number;
  add: (item: StoredItem, opts?: { silent?: boolean }) => void;
  setQty: (productId: number, variationId: number | null, qty: number) => void;
  remove: (productId: number, variationId: number | null) => void;
  clear: () => void;
  wish: number[];
  toggleWish: (id: number) => boolean;
  toast: (msg: string, link?: Toast['link'], err?: boolean) => void;
  ready: boolean;
};

const C = createContext<Ctx | null>(null);
export const useShop = () => {
  const c = useContext(C);
  if (!c) throw new Error('CartProvider missing');
  return c;
};

const same = (a: StoredItem, productId: number, variationId: number | null) => a.productId === productId && (a.variationId ?? null) === (variationId ?? null);

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* حالت خصوصی */ }
}

export default function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<StoredItem[]>([]);
  const [wish, setWish] = useState<number[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ready, setReady] = useState(false);
  const tid = useRef(0);

  useEffect(() => {
    setItems(read<StoredItem[]>('vt_cart', []));
    setWish(read<number[]>('vt_wish', []));
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'vt_cart') setItems(read('vt_cart', []));
      if (e.key === 'vt_wish') setWish(read('vt_wish', []));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toast = useCallback((msg: string, link?: Toast['link'], err?: boolean) => {
    const id = ++tid.current;
    setToasts((t) => [...t.slice(-1), { id, msg, link, err }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const persist = (next: StoredItem[]) => { setItems(next); write('vt_cart', next); };

  const add: Ctx['add'] = useCallback((item, opts) => {
    setItems((cur) => {
      const i = cur.findIndex((x) => same(x, item.productId, item.variationId));
      const next = i >= 0 ? cur.map((x, k) => (k === i ? { ...x, qty: Math.min(99, x.qty + item.qty) } : x)) : [...cur, item];
      write('vt_cart', next);
      return next;
    });
    if (!opts?.silent) toast('به سبد خرید اضافه شد', { href: '/cart', text: 'مشاهده‌ی سبد' });
    window.dispatchEvent(new Event('vt-cart-bump'));
  }, [toast]);

  const setQty: Ctx['setQty'] = (pid, vid, qty) => persist(items.map((x) => (same(x, pid, vid) ? { ...x, qty: Math.max(1, Math.min(99, qty)) } : x)));
  const remove: Ctx['remove'] = (pid, vid) => persist(items.filter((x) => !same(x, pid, vid)));
  const clear = () => persist([]);

  const toggleWish = (id: number) => {
    const on = !wish.includes(id);
    const next = on ? [...wish, id] : wish.filter((x) => x !== id);
    setWish(next);
    write('vt_wish', next);
    toast(on ? 'به علاقه‌مندی‌ها اضافه شد' : 'از علاقه‌مندی‌ها حذف شد', on ? { href: '/wishlist', text: 'مشاهده' } : undefined);
    return on;
  };

  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);
  const value: Ctx = { items, count, add, setQty, remove, clear, wish, toggleWish, toast, ready };

  return (
    <C.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.err ? ' err' : ''}`} role={t.err ? 'alert' : 'status'}>
            {t.err ? <AlertCircle className="i" /> : <Check className="i" />}
            <span>{t.msg}</span>
            {t.link && <Link href={t.link.href}>{t.link.text}</Link>}
          </div>
        ))}
      </div>
    </C.Provider>
  );
}

export function CountBadge({ n, className = 'count' }: { n: number; className?: string }) {
  const [bump, setBump] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setBump(true);
    const t = setTimeout(() => setBump(false), 450);
    return () => clearTimeout(t);
  }, [n]);
  if (n <= 0) return null;
  return <span className={`${className} num${bump ? ' bump' : ''}`}>{fa(n)}</span>;
}
