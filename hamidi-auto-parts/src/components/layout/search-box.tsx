"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Search, X } from "lucide-react";
import { queryProducts } from "@/lib/catalog";
import { cn, formatPrice, toFa } from "@/lib/utils";
import { getCategory } from "@/data/categories";

const SUGGESTIONS = ["لنت ترمز", "کمک‌فنر مورانو", "واترپمپ", "15208-65F0E", "سیبک", "HAP-HN-3141"];

export function SearchBox({ className, autoFocus, onNavigate, size = "md" }: { className?: string; autoFocus?: boolean; onNavigate?: () => void; size?: "md" | "lg" }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 160);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const results = useMemo(() => (debounced.trim().length > 1 ? queryProducts({ q: debounced }) : []), [debounced]);
  const pending = q !== debounced;

  function go(path: string) {
    setOpen(false);
    setActive(-1);
    onNavigate?.();
    router.push(path);
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (active >= 0 && results[active]) return go(`/product/${results[active].slug}`);
    if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, Math.min(results.length, 6) - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
    if (e.key === "Escape") setOpen(false);
  }

  const show = open && (q.trim().length > 1 || q.length === 0);

  return (
    <div ref={wrap} className={cn("relative w-full", className)}>
      <form onSubmit={submit} role="search" className="relative">
        <Search className={cn("pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-neutral-400", size === "lg" ? "size-5" : "size-[18px]")} />
        <input
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="جستجوی نام قطعه، کد فنی یا شماره OEM…"
          aria-label="جستجوی قطعات"
          className={cn(
            "w-full rounded-2xl border border-neutral-200 bg-neutral-50 pr-12 pl-28 text-sm text-neutral-950 transition-all outline-none placeholder:text-neutral-400 focus:border-neutral-950 focus:bg-white focus:shadow-[0_0_0_4px_rgba(11,11,13,.06)]",
            size === "lg" ? "h-14 text-base" : "h-12",
          )}
        />
        {q && (
          <button type="button" onClick={() => { setQ(""); setActive(-1); }} className="absolute top-1/2 left-[5.6rem] grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700" aria-label="پاک کردن">
            <X className="size-4" />
          </button>
        )}
        <button type="submit" className={cn("absolute top-1.5 bottom-1.5 left-1.5 cursor-pointer rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-primary")}>
          جستجو
        </button>
      </form>

      {show && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-neutral-200 bg-white text-neutral-950 shadow-[0_24px_60px_-20px_rgba(0,0,0,.35)] animate-in fade-in-0 slide-in-from-top-2">
          {q.trim().length <= 1 ? (
            <div className="p-4">
              <p className="mb-3 text-xs font-semibold text-neutral-500">جستجوهای پرتکرار</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => { setQ(s); setOpen(true); }} className="cursor-pointer rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium transition hover:border-primary hover:text-primary">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : pending ? (
            <div className="flex items-center gap-2 p-5 text-sm text-neutral-500"><Loader2 className="size-4 animate-spin" />در حال جستجو…</div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-sm text-neutral-500">
              قطعه‌ای با «{q}» پیدا نشد.
              <Link href="/contact" onClick={() => setOpen(false)} className="mt-2 block font-semibold text-primary">استعلام قطعه از کارشناس ←</Link>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5 text-xs text-neutral-500">
                <span>{toFa(results.length)} قطعه یافت شد</span>
                <span className="hidden sm:inline">برای انتخاب از ↑ ↓ استفاده کنید</span>
              </div>
              <ul className="max-h-[60vh] overflow-y-auto">
                {results.slice(0, 6).map((p, i) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(`/product/${p.slug}`)}
                      className={cn("flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-right transition", active === i ? "bg-neutral-100" : "hover:bg-neutral-50")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.image} alt="" className="size-12 shrink-0 rounded-lg bg-studio object-contain p-1" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{p.name}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500">
                          <span className="ltr-nums font-mono">{p.sku}</span>
                          <span>·</span>
                          <span>{getCategory(p.category)?.nameFa}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-bold">{formatPrice(p.price)} <span className="font-normal text-neutral-400">تومان</span></span>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => submit()} className="flex w-full cursor-pointer items-center justify-center gap-2 border-t border-neutral-100 bg-neutral-50 py-3 text-sm font-semibold text-primary hover:bg-neutral-100">
                مشاهده همه نتایج برای «{q}» <ArrowLeft className="size-4" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
