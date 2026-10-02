import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Search, X } from 'lucide-react';
import { products } from '@/data/products';
import { categories } from '@/data/categories';
import { useShop } from '@/store';
import { searchProducts } from '@/utils/search';
import { formatPrice } from '@/utils/format';
import { ProductArt } from './ProductArt';

export function SearchOverlay() {
  const { searchOpen, setSearchOpen, recentSearches, addRecentSearch, clearRecent } = useShop();
  const [q, setQ] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  const close = () => setSearchOpen(false);
  useEffect(() => {
    if (!searchOpen) return;
    setTimeout(() => ref.current?.focus(), 100);
    document.body.style.overflow = 'hidden';
    const h = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', h);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', h); };
  }, [searchOpen]);
  const results = useMemo(() => (q ? searchProducts(products, q).slice(0, 6) : products.filter((p) => p.isFeatured).slice(0, 4)), [q]);
  const relatedCats = useMemo(() => (q ? categories.filter((c) => c.name.includes(q) || results.some((r) => r.category === c.slug)) : categories.slice(0, 4)), [q, results]);
  const go = (term: string) => { addRecentSearch(term); close(); setQ(''); nav(`/shop?q=${encodeURIComponent(term)}`); };
  return (
    <AnimatePresence>
      {searchOpen && (
        <motion.div className="fixed inset-0 z-[85] overflow-y-auto bg-ink/95 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="container-x max-w-3xl pb-16 pt-6">
            <form onSubmit={(e) => { e.preventDefault(); q.trim() && go(q); }} className="flex items-center gap-3 border-b border-white/20 pb-4">
              <Search className="text-mist/60" />
              <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی محصول، دسته، مدل گوشی یا برند…" className="flex-1 bg-transparent text-xl font-bold text-white outline-none placeholder:text-mist/30 md:text-3xl" />
              <button type="button" onClick={close} aria-label="بستن" className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><X size={20} /></button>
            </form>
            {!q && recentSearches.length > 0 && (
              <div className="mt-8">
                <div className="mb-3 flex justify-between text-xs"><b className="text-white">جستجوهای اخیر</b><button onClick={clearRecent} className="text-mist/50 hover:text-white">پاک کردن</button></div>
                <div className="flex flex-wrap gap-2">{recentSearches.map((r) => <button key={r} onClick={() => go(r)} className="chip flex items-center gap-1.5 text-mist hover:bg-white/10"><Clock size={12} />{r}</button>)}</div>
              </div>
            )}
            <div className="mt-8">
              <b className="mb-3 block text-xs text-white">{q ? `نتایج (${results.length})` : 'محصولات پیشنهادی'}</b>
              {results.length === 0 && <p className="text-sm text-mist/60">محصولی پیدا نشد.</p>}
              <div className="grid gap-2 sm:grid-cols-2">
                {results.map((p) => (
                  <Link key={p.id} to={`/product/${p.slug}`} onClick={() => { addRecentSearch(q); close(); }} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:border-violet/50">
                    <ProductArt kind={p.art} color={p.colors[0].hex} className="h-14 w-14 shrink-0" />
                    <div className="min-w-0"><p className="line-clamp-1 text-sm font-bold text-white">{p.name}</p><p className="text-xs text-mist/60">{formatPrice(p.price)}</p></div>
                  </Link>
                ))}
              </div>
            </div>
            <div className="mt-8">
              <b className="mb-3 block text-xs text-white">دسته‌بندی‌های مرتبط</b>
              <div className="flex flex-wrap gap-2">{relatedCats.map((c) => <Link key={c.slug} onClick={close} to={`/category/${c.slug}`} className="chip text-mist hover:bg-white/10">{c.name}</Link>)}</div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
