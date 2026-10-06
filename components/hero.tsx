"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, RotateCcw, Search, ShieldCheck, Truck } from "lucide-react";
import { Container } from "@/components/ui";
import { SiteImage } from "@/components/site-image";
import { ProductVisual } from "@/components/product-visual";
import { toFa } from "@/lib/utils";
import type { CardProduct } from "@/lib/types";

const heroWords = ["قاب", "گلس", "شارژر", "هندزفری", "پاوربانک"];

function Plate({ p, className, sizes, priority }: { p: CardProduct; className?: string; sizes: string; priority?: boolean }) {
  return (
    <Link href={`/product/${p.slug}`} className={`group relative block overflow-hidden rounded-[10px] bg-surface-2 ${className ?? ""}`} style={p.img ? undefined : { background: `color-mix(in srgb, hsl(${p.hue} 40% 52%) 18%, var(--surface-2))` }} aria-label={p.name}>
      {p.img ? <SiteImage src={p.img} alt={p.name} sizes={sizes} priority={priority} className="transition-transform duration-[400ms] ease-out group-hover:scale-[1.03]" /> : <ProductVisual kind={p.kind} hue={(p.hue + 180) % 360} className="absolute inset-0 size-full p-[16%] drop-shadow-[0_18px_18px_rgb(20_32_27/0.22)]" />}
    </Link>
  );
}

/** Home hero: a large Persian serif headline with the search field on one side, and a three-photo composition of real, current products on the other. */
export function Hero({ chips, featured = [] }: { chips: string[]; featured?: CardProduct[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % heroWords.length), 2600);
    return () => clearInterval(t);
  }, []);
  const [a, b, c] = featured;
  return (
    <section className="border-b border-border">
      <Container className="grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:py-20">
        <div className="hero-rise">
          <p className="mb-5 inline-flex items-center gap-3 text-[12px] font-bold tracking-wide text-muted"><span className="h-px w-8 bg-foreground" aria-hidden />فروشگاه لوازم جانبی موبایل</p>
          <h1 className="font-display text-[44px] leading-[1.12] sm:text-[64px] lg:text-[76px]">
            <span className="relative inline-block text-primary" data-hero-word>{heroWords[i]}
              <svg className="absolute -bottom-1 start-0 h-2 w-full text-accent" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden><path d="M1 5.5C25 1.5 55 7 99 2.5" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" /></svg>
            </span>{" "}اورجینال
            <span className="mt-1 block text-[0.62em] leading-[1.25] text-foreground/85">سریع و مطمئن، با ضمانت بازگشت</span>
          </h1>
          <p className="mt-5 max-w-[34rem] text-[15px] leading-8 text-muted sm:text-base">لوازم جانبی محبوب موبایل، قاب، گلس و شارژر، همه در یک‌جا.</p>
          <form role="search" data-search-form className="mt-8 hidden h-14 max-w-[560px] items-center gap-2 rounded-full border border-border-strong bg-card ps-5 pe-1.5 transition-colors focus-within:border-foreground lg:flex" onSubmit={(e) => e.preventDefault()}>
            <Search className="size-[18px] shrink-0 text-foreground" aria-hidden />
            <input id="hero-search" type="search" aria-label="جستجو" placeholder="نام محصول یا مدل گوشی…" className="h-full min-w-0 flex-1 bg-transparent text-start text-[15px] outline-none placeholder:text-muted/80" />
            <span className="hidden h-11 items-center rounded-full bg-primary px-5 text-[13px] font-semibold text-primary-fg sm:inline-flex">جستجو</span>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-1 text-[13px]">
            <span className="me-1 text-[12px] text-muted">پرجستجو:</span>
            {chips.map((c) => <Link key={c} href="/shop" className="rounded-full px-3 py-1.5 font-medium text-foreground underline decoration-border-strong decoration-1 underline-offset-[6px] transition-colors hover:text-primary hover:decoration-primary">{c}</Link>)}
          </div>
          <ul className="mt-9 grid max-w-[560px] grid-cols-3 gap-4 border-t border-border pt-6 text-[12px] leading-6 text-muted">
            {[[ShieldCheck, "اصالت کالا"], [Truck, "ارسال سریع"], [RotateCcw, "بازگشت ۷ روزه"]].map(([I, t]) => { const Ic = I as typeof Truck; return <li key={t as string} className="flex items-center gap-2"><Ic className="size-5 shrink-0 text-primary" strokeWidth={1.6} /><span className="font-semibold text-foreground">{t as string}</span></li>; })}
          </ul>
        </div>

        {a && (
          <div className="relative mx-auto w-full max-w-[560px] lg:max-w-none" aria-label="محصولات تازه">
            <div className="grid grid-cols-[1.15fr_0.85fr] items-stretch gap-3 sm:gap-4">
              <Plate p={a} sizes="(min-width: 1024px) 28vw, 56vw" priority className="hero-rise aspect-[4/5]" />
              <div className="flex flex-col gap-3 sm:gap-4">
                {b && <Plate p={b} sizes="(min-width: 1024px) 20vw, 40vw" className="hero-rise min-h-0 flex-1 [animation-delay:90ms]" />}
                {c && <Plate p={c} sizes="(min-width: 1024px) 20vw, 40vw" className="hero-rise min-h-0 flex-1 [animation-delay:160ms]" />}
              </div>
            </div>
            <Link href={`/product/${a.slug}`} className="hero-rise absolute -bottom-4 start-3 flex max-w-[78%] items-center gap-3 rounded-[10px] border border-border bg-card px-4 py-3 shadow-md transition-transform duration-200 hover:-translate-y-0.5 sm:start-6 [animation-delay:240ms]">
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold text-muted">تازه رسیده</span>
                <span className="block truncate text-[13px] font-bold">{a.name}</span>
                <span className="block text-[14px] font-extrabold num">{toFa(a.price)} <span className="text-[11px] font-medium text-muted">تومان</span></span>
              </span>
              <span className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-primary text-primary-fg"><ArrowLeft className="size-4" /></span>
            </Link>
          </div>
        )}
      </Container>
    </section>
  );
}
