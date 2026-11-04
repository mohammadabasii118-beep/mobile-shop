"use client";

import { useEffect, useId, useRef, useState } from "react";
import Form from "next/form";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Search, X } from "lucide-react";
import type { SearchSuggestion } from "@/lib/cart-item";
import { cn, formatPrice, toFa } from "@/lib/utils";

const POPULAR = ["لنت ترمز", "کمک‌فنر مورانو", "واترپمپ", "15208-65F0E", "سیبک", "تسمه تایم"];

/**
 * Header search. A plain <form action="/search"> (works before hydration);
 * once hydrated it shows live suggestions fetched from /api/search, so the
 * product catalogue never ships to the browser.
 */
export function SearchAutocomplete({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [state, setState] = useState<{ q: string; total: number; items: SearchSuggestion[] } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const term = q.trim();
  const loading = term.length > 1 && state?.q !== term;

  useEffect(() => {
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = await res.json();
        setState({ q: term, ...data });
      } catch { /* aborted */ }
    }, 180);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [term]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const items = state?.q === term ? state.items : [];

  return (
    <div ref={wrap} className={cn("relative w-full", className)}>
      <Form
        action="/search"
        role="search"
        className="relative"
        onSubmit={(e) => {
          if (active >= 0 && items[active]) { e.preventDefault(); setOpen(false); router.push(items[active].href); }
          else setOpen(false);
        }}
      >
        <Search className={cn("pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-neutral-500", size === "lg" ? "size-5" : "size-[18px]")} aria-hidden />
        <input
          type="search"
          name="q"
          value={q}
          required
          minLength={2}
          autoComplete="off"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-label="جستجوی قطعات با نام، کد فنی یا شماره OEM"
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="جستجوی نام قطعه، کد فنی یا شماره OEM…"
          className={cn(
            "w-full rounded-2xl border border-neutral-300 bg-neutral-50 pr-12 pl-28 text-[16px] text-neutral-950 transition-[border,box-shadow,background] outline-none placeholder:text-neutral-500 focus:border-neutral-950 focus:bg-white focus:shadow-[0_0_0_4px_rgba(11,11,13,.06)] sm:text-sm",
            size === "lg" ? "h-14" : "h-12",
          )}
        />
        {q && (
          <button type="button" onClick={() => { setQ(""); setActive(-1); }} className="absolute top-1/2 left-[5.6rem] grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800" aria-label="پاک کردن عبارت جستجو">
            <X className="size-4" />
          </button>
        )}
        <button type="submit" className="absolute top-1.5 bottom-1.5 left-1.5 cursor-pointer rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-primary">جستجو</button>
      </Form>

      {open && (
        <div id={listId} role="listbox" aria-label="پیشنهادهای جستجو" className="absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-neutral-200 bg-white text-neutral-950 shadow-[0_24px_60px_-20px_rgba(0,0,0,.35)] animate-in fade-in-0 slide-in-from-top-2">
          {term.length < 2 ? (
            <div className="p-4">
              <p className="mb-3 text-xs font-semibold text-neutral-600">جستجوهای پرتکرار</p>
              <div className="flex flex-wrap gap-2">
                {POPULAR.map((s) => (
                  <button key={s} type="button" onClick={() => setQ(s)} className="cursor-pointer rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium transition hover:border-primary hover:text-primary">{s}</button>
                ))}
              </div>
            </div>
          ) : loading ? (
            <p className="flex items-center gap-2 p-5 text-sm text-neutral-600"><Loader2 className="size-4 animate-spin" aria-hidden />در حال جستجو…</p>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-sm text-neutral-600">
              قطعه‌ای با «{term}» پیدا نشد.
              <Link href="/contact" onClick={() => setOpen(false)} className="mt-2 block font-semibold text-primary">استعلام قطعه از کارشناس ←</Link>
            </div>
          ) : (
            <>
              <p className="border-b border-neutral-100 px-4 py-2.5 text-xs text-neutral-600">{toFa(state?.total ?? 0)} قطعه یافت شد</p>
              <ul className="max-h-[60vh] overflow-y-auto">
                {items.map((p, i) => (
                  <li key={p.href} id={`${listId}-${i}`} role="option" aria-selected={active === i}>
                    <Link href={p.href} onClick={() => setOpen(false)} onMouseEnter={() => setActive(i)} className={cn("flex items-center gap-3 px-4 py-2.5 transition", active === i ? "bg-neutral-100" : "hover:bg-neutral-50")}>
                      <Image src={p.image} alt="" width={96} height={96} sizes="48px" className="size-12 shrink-0 rounded-lg bg-studio object-contain p-1" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{p.name}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-600"><span className="ltr-nums font-mono">{p.sku}</span><span aria-hidden>·</span><span>{p.category}</span></span>
                      </span>
                      <span className="shrink-0 text-xs font-bold">{formatPrice(p.price)} <span className="font-normal text-neutral-600">تومان</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={`/search?q=${encodeURIComponent(term)}`} onClick={() => setOpen(false)} className="flex items-center justify-center gap-2 border-t border-neutral-100 bg-neutral-50 py-3 text-sm font-semibold text-primary hover:bg-neutral-100">
                مشاهده همه نتایج برای «{term}» <ArrowLeft className="size-4" aria-hidden />
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
