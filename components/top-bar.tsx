"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Megaphone, PackageSearch, Percent, Send, Camera } from "lucide-react";
import type { TopBarItemView, TopBarSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICON: Record<string, typeof Send> = { telegram: Send, instagram: Camera, tracking: PackageSearch, discount: Percent, link: Megaphone };
const CTA: Record<string, string> = { telegram: "عضویت", instagram: "مشاهده", tracking: "ورود به کانال", discount: "کپی کد", link: "مشاهده" };

function Item({ it }: { it: TopBarItemView }) {
  const Icon = ICON[it.kind] ?? Megaphone;
  const [copied, setCopied] = useState(false);
  const cta = it.ctaLabel || CTA[it.kind] || "مشاهده";
  const chip = "shrink-0 cursor-pointer rounded-full bg-primary/14 px-2.5 py-0.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary/25 focus-visible:outline-2 focus-visible:outline-primary";
  const copy = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1600); };
    try { void navigator.clipboard.writeText(it.copyText!).then(done, () => {}); } catch { /* clipboard blocked: the code is visible, the user can copy it by hand */ }
  };
  const external = !!it.link && !it.link.startsWith("/") && !it.link.startsWith("#") && !/^(tel|mailto):/.test(it.link);
  return (
    <div className="flex h-full items-center justify-center gap-2 px-11 text-[11px] sm:text-xs" data-topbar-item>
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-fg"><Icon className="size-3" /></span>
      <span className="min-w-0 truncate"><b className="font-extrabold text-foreground">{it.title}</b>{it.subtitle && <span className="hidden text-muted sm:inline"> {it.subtitle}</span>}</span>
      {it.copyText && <><bdi className="shrink-0 rounded border border-dashed border-primary bg-surface px-1.5 font-extrabold tracking-wider" dir="ltr">{it.copyText}</bdi>
        <button type="button" onClick={copy} className={chip}>{copied ? <span className="inline-flex items-center gap-1"><Check className="size-3" />کپی شد</span> : it.ctaLabel || CTA.discount}</button></>}
      {!it.copyText && it.link && (it.link.startsWith("/") ? <Link href={it.link} className={chip}>{cta}</Link> : <a href={it.link} className={chip} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{cta}</a>)}
    </div>
  );
}

/**
 * The bar at the very top of the site. Modes (set in the admin): auto = rotates by itself (rise / fade / slide), manual = swipe or arrows only,
 * both = rotates and can also be swiped. A fixed height keeps the page from jumping; pauses on hover/focus/touch; respects reduced motion.
 */
export function TopBar({ items, settings }: { items: TopBarItemView[]; settings: TopBarSettings }) {
  const n = items.length, many = n > 1;
  const manual = settings.mode !== "auto" && many, auto = settings.mode !== "manual" && many;
  const [cur, setCur] = useState(0); const [prev, setPrev] = useState(-1);
  const paused = useRef(false); const scroller = useRef<HTMLDivElement>(null); const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [reduce, setReduce] = useState(false);
  useEffect(() => { setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []); // eslint-disable-line react-hooks/set-state-in-effect
  const rtl = true;

  const width = () => scroller.current?.clientWidth || 1;
  const idx = () => Math.min(n - 1, Math.max(0, Math.round(Math.abs(scroller.current?.scrollLeft ?? 0) / width())));
  const goTo = useCallback((i: number, smooth = true) => {
    const k = ((i % n) + n) % n;
    if (manual) scroller.current?.scrollTo({ left: (rtl ? -1 : 1) * k * width(), behavior: smooth && !reduce ? "smooth" : "auto" });
    else { setPrev((p) => (k === cur ? p : cur)); setCur(k); }
  }, [n, manual, reduce, cur]); // eslint-disable-line react-hooks/exhaustive-deps

  const restart = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (!auto) return;
    timer.current = setInterval(() => { if (!paused.current && document.visibilityState === "visible") goTo((manual ? idx() : cur) + 1); }, settings.displaySeconds * 1000);
  }, [auto, manual, cur, goTo, settings.displaySeconds]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { restart(); return () => { if (timer.current) clearInterval(timer.current); }; }, [restart]);

  // keep the dots in step with native scrolling in manual / both mode
  useEffect(() => {
    const el = scroller.current; if (!manual || !el) return;
    const on = () => setCur(idx());
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, [manual]); // eslint-disable-line react-hooks/exhaustive-deps

  // mouse drag (touch uses native scrolling)
  const drag = useRef<{ x: number; l: number } | null>(null);
  const hold = (p: boolean) => { paused.current = p; };
  const style = { "--tb-ms": `${settings.transitionMs}ms` } as React.CSSProperties;

  return (
    <div className="relative bg-primary/10 text-muted" role="region" aria-roledescription={many ? "carousel" : undefined} aria-label="اعلان‌ها" style={style} data-testid="topbar" data-mode={settings.mode} data-count={n}
      onMouseEnter={() => settings.pauseOnHover && hold(true)} onMouseLeave={() => hold(false)} onFocus={() => hold(true)} onBlur={() => hold(false)}
      onTouchStart={() => hold(true)} onTouchEnd={() => { setTimeout(() => hold(false), 2000); restart(); }}>
      {manual ? (
        <div ref={scroller} tabIndex={0} aria-label="اعلان‌ها؛ با کلیدهای جهت‌دار جابه‌جا شوید" data-testid="topbar-scroller"
          className="no-scrollbar flex h-9 cursor-grab snap-x snap-mandatory overflow-x-auto"
          onKeyDown={(e) => { if (e.key === "ArrowLeft") { goTo(idx() + 1); e.preventDefault(); } if (e.key === "ArrowRight") { goTo(idx() - 1); e.preventDefault(); } }}
          onPointerDown={(e) => { if (e.pointerType !== "mouse" || (e.target as HTMLElement).closest("a,button")) return; drag.current = { x: e.clientX, l: scroller.current!.scrollLeft }; scroller.current!.style.scrollSnapType = "none"; scroller.current!.setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (drag.current) scroller.current!.scrollLeft = drag.current.l - (e.clientX - drag.current.x); }}
          onPointerUp={() => { if (!drag.current) return; drag.current = null; scroller.current!.style.scrollSnapType = ""; goTo(idx()); restart(); }}
          onPointerCancel={() => { drag.current = null; scroller.current!.style.scrollSnapType = ""; }}>
          {items.map((it) => <div key={it.id} className="h-full w-full shrink-0 snap-center snap-always select-none"><Item it={it} /></div>)}
        </div>
      ) : (
        <div className="relative h-9 overflow-hidden" data-testid="topbar-stage">
          {items.map((it, i) => {
            const on = i === cur, out = i === prev && !on;
            const base = reduce ? "transition-opacity" : "transition-[transform,opacity]";
            const hidden = settings.animation === "slide" ? (out ? "-translate-x-full" : "translate-x-full") : settings.animation === "rise" ? (out ? "-translate-y-3/4" : "translate-y-3/4") : "";
            return <div key={it.id} aria-hidden={!on} inert={!on} data-active={on} className={cn("absolute inset-0 ease-out", base, on ? "translate-x-0 translate-y-0 opacity-100" : cn("pointer-events-none opacity-0", hidden))} style={{ transitionDuration: reduce ? "150ms" : "var(--tb-ms)" }}><Item it={it} /></div>;
          })}
        </div>
      )}
      {manual && <>
        <button type="button" aria-label="قبلی" onClick={() => { goTo(idx() - 1); restart(); }} className="absolute start-1.5 top-1/2 hidden size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-surface/80 text-primary sm:grid"><ChevronRight className="size-3.5" /></button>
        <button type="button" aria-label="بعدی" onClick={() => { goTo(idx() + 1); restart(); }} className="absolute end-1.5 top-1/2 hidden size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-surface/80 text-primary sm:grid"><ChevronLeft className="size-3.5" /></button>
      </>}
      {many && <div className="pointer-events-none absolute inset-x-0 bottom-0.5 flex justify-center gap-1" aria-hidden>{items.map((it, i) => <i key={it.id} className={cn("h-1 rounded-full transition-all duration-300", i === cur ? "w-3 bg-primary" : "w-1 bg-foreground/25")} />)}</div>}
    </div>
  );
}
