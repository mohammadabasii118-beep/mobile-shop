"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Clock, Flame, Search, X } from "lucide-react";
import { POPULAR_SEARCHES, searchCatalog } from "@/lib/search";
import { Price } from "@/components/ui/price";
import { ProductArt } from "@/components/product/product-art";
import { cn } from "@/lib/utils";

const RECENT_KEY = "volta-recent-searches";

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Autocomplete: محصول / دسته / برند + اخیر + پرطرفدار (DESIGN: Search) */
export function SearchBox({ className, autoFocus, onDone }: { className?: string; autoFocus?: boolean; onDone?: () => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(!!autoFocus);
  const [recent, setRecent] = useState<string[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();
  const results = useMemo(() => searchCatalog(q), [q]);
  const has = results.products.length + results.categories.length + results.brands.length > 0;

  useEffect(() => setRecent(readRecent()), []);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const commit = (term: string) => {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...recent.filter((r) => r !== t)].slice(0, 4);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
    setQ(t);
  };

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          commit(q);
        }}
        className="flex min-h-11 items-center gap-2 rounded-full bg-secondary px-4 transition-shadow focus-within:shadow-[0_0_0_2px_var(--fg)]"
      >
        <Search className="size-4 shrink-0 text-muted" aria-hidden />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          autoFocus={autoFocus}
          type="search"
          placeholder="جستجوی قاب، شارژر، ایربادز…"
          aria-label="جستجو در فروشگاه"
          aria-expanded={open}
          aria-controls={id}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="پاک کردن" className="grid size-8 place-items-center rounded-full text-muted hover:text-fg">
            <X className="size-4" />
          </button>
        )}
      </form>

      {open && (
        <div id={id} className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] min-w-72 overflow-auto rounded-xl bg-elevated p-3 shadow-float ring-1 ring-line md:w-[28rem] md:max-w-[90vw]">
          {!q ? (
            <div className="space-y-4 p-1">
              {recent.length > 0 && (
                <div>
                  <p className="t-caption mb-2 flex items-center gap-1.5 text-muted"><Clock className="size-3.5" />جستجوهای اخیر</p>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <button key={r} onClick={() => setQ(r)} className="min-h-9 rounded-full bg-secondary px-3 text-sm">{r}</button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="t-caption mb-2 flex items-center gap-1.5 text-muted"><Flame className="size-3.5" />پرطرفدار</p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_SEARCHES.map((r) => (
                    <button key={r} onClick={() => commit(r)} className="min-h-9 rounded-full bg-secondary px-3 text-sm">
                      <bdi>{r}</bdi>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : has ? (
            <div className="space-y-3">
              {results.products.length > 0 && (
                <ul>
                  {results.products.map((p) => (
                    <li key={p.id}>
                      <a href="#product-preview" onClick={() => { commit(q); setOpen(false); onDone?.(); }} className="flex items-center gap-3 rounded-md p-2 hover:bg-secondary">
                        <span className="grid size-12 shrink-0 place-items-center rounded-sm bg-stage">
                          <ProductArt kind={p.kind} color={p.colors[0].hex} className="size-11" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{p.name}</span>
                          <span className="t-caption text-muted"><bdi>{p.brand}</bdi></span>
                        </span>
                        <Price value={p.price} size="sm" showDiscount={false} />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {(results.categories.length > 0 || results.brands.length > 0) && (
                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  {results.categories.map((c) => (
                    <a key={c.id} href="#categories" onClick={() => { setOpen(false); onDone?.(); }} className="inline-flex min-h-9 items-center rounded-full bg-secondary px-3 text-sm">دسته: {c.name}</a>
                  ))}
                  {results.brands.map((b) => (
                    <span key={b} className="inline-flex min-h-9 items-center rounded-full bg-secondary px-3 text-sm">برند: <bdi className="ms-1">{b}</bdi></span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="p-4 text-center text-sm text-muted">نتیجه‌ای برای «{q}» پیدا نشد.</p>
          )}
        </div>
      )}
    </div>
  );
}
