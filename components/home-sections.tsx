"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, Search, Send } from "lucide-react";
import { Container, SectionHeader } from "@/components/ui";
import { ProductCard } from "@/components/product-card";
import { ProductVisual } from "@/components/product-visual";
import { blogPosts2, brands, catalog, heroWords, quickChips, rails, shopCats, type Kind, type Product } from "@/lib/data";
import { toFa } from "@/lib/utils";

export function Hero() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % heroWords.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="py-8 text-center sm:py-14">
      <Container className="max-w-3xl">
        <h1 className="text-3xl font-black leading-[1.5] sm:text-5xl sm:leading-[1.5]">
          <span className="text-primary" data-hero-word>{heroWords[i]}</span> اورجینال
          <br />سریع و مطمئن، با ضمانت بازگشت
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-8 text-muted sm:text-base">لوازم جانبی محبوب موبایل، قاب، گلس، شارژر، هندزفری و بیشتر، با تضمین سازگاری کامل با مدل گوشی شما.</p>
        <form role="search" data-search-form className="glass relative mx-auto mt-6 flex h-14 items-center rounded-full px-5 shadow-md" onSubmit={(e) => e.preventDefault()}>
          <input id="hero-search" type="search" placeholder="اسم محصول یا مدل گوشی رو بنویس… مثلا iPhone 15" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" />
          <Search className="size-5 text-primary" />
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-muted">پیشنهادها:</span>
          {quickChips.map((c) => <Link key={c} href="/shop" className="glass cursor-pointer rounded-full px-3.5 py-1.5 font-medium transition-all duration-200 hover:border-primary hover:bg-surface hover:text-primary hover:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_16%,transparent)]">{c}</Link>)}
        </div>
      </Container>
    </section>
  );
}

export function BrandMarquee() {
  const row = [...brands, ...brands];
  return (
    <section className="py-3">
      <p className="mb-3 text-center text-[11px] text-muted">برندهایی که در <b className="text-primary">کیس‌لاین</b> پیدا می‌کنی</p>
      <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]" dir="ltr">
        <div className="flex w-max animate-[marquee_28s_linear_infinite] gap-10 text-xl font-extrabold text-muted/70 sm:gap-14 sm:text-2xl">
          {row.map((b, i) => <span key={i} className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-primary/50" />{b}</span>)}
        </div>
      </div>
    </section>
  );
}

function ProductRail({ slug, title, items, href }: { slug: string; title: string; items: Product[]; href?: string }) {
  return (
    <section id={slug} className="scroll-mt-24 py-5">
      <Container>
        <SectionHeader title={title} href={href ?? `/shop#${["iphone", "samsung", "xiaomi"].includes(slug) ? "cases" : slug}`} />
        <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
          {items.map((p) => <div key={p.id} className="w-[42%] shrink-0 snap-start sm:w-[calc((100%-3rem)/5)]"><ProductCard p={p} /></div>)}
        </div>
      </Container>
    </section>
  );
}

const railBy = (slug: string) => rails.find((r) => r.slug === slug)!;
export function Rails({ slugs }: { slugs: string[] }) {
  return <>{slugs.map((s) => <ProductRail key={s} {...railBy(s)} />)}</>;
}
export function NewestRail() {
  const items = catalog.filter((p) => p.badge === "جدید").concat(catalog.slice(-5)).slice(0, 5);
  return <ProductRail slug="new" title="تازه‌ترین محصولات" items={items} href="/shop" />;
}

const tileKinds: Record<string, Kind[]> = {
  cases: ["case", "case", "case"], airpods: ["airpods", "airpods", "airpods"], watch: ["watch", "watch", "watch"],
  electric: ["charger", "cable", "powerbank"], accessories: ["glass", "earbuds", "holder"],
};
const tileHues = [14, 200, 30];

export function CategoryTiles() {
  return (
    <section className="py-5">
      <Container>
        <SectionHeader title="دسته‌بندی‌ها" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {shopCats.map((c) => (
            <Link key={c.slug} href={`/shop#${c.slug}`} className="group flex flex-col items-center gap-2 rounded-lg border border-transparent bg-surface-2 px-3 py-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-surface hover:shadow-md">
              <span className="flex gap-1 transition-transform duration-200 group-hover:scale-105" dir="rtl">
                {tileKinds[c.slug].map((k, i) => <span key={i} className="grid size-8 place-items-center rounded-full bg-surface shadow-sm"><ProductVisual kind={k} hue={tileHues[i]} className="size-6" /></span>)}
              </span>
              <span className="text-sm font-bold">{c.label}</span>
              <span className="text-[11px] text-muted">{toFa(catalog.filter(c.test).length)} محصول</span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function TelegramBanner() {
  return (
    <section className="py-6">
      <Container>
        <a href="https://t.me/caseline_shop" target="_blank" rel="noopener noreferrer" className="relative flex min-h-44 items-center overflow-hidden rounded-[28px] p-6 text-white shadow-lg sm:min-h-56 sm:p-10" style={{ background: "linear-gradient(110deg,#1f9bea 0%,#1465c0 100%)" }}>
          <span className="absolute -start-6 top-1/2 grid size-40 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-br from-[#7fd3ff] to-[#1a7fc4] shadow-2xl sm:size-52"><Send className="size-16 -rotate-12 sm:size-24" /></span>
          <span className="absolute start-44 top-5 size-8 rounded-full bg-white/25 sm:start-60" />
          <span className="absolute bottom-4 start-8 size-5 rounded-full bg-white/25" />
          <div className="relative ms-auto w-[62%] text-end sm:w-[60%]">
            <p className="text-sm font-black sm:text-2xl">داغ‌ترین کدهای تخفیف و پیشنهادهای ویژه</p>
            <p className="mt-2 text-base font-black sm:text-3xl">فقط و فقط در کانال تلگرام کیس‌لاین</p>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-black/35 px-4 py-2 text-xs font-bold sm:text-base">ورود به کانال<ChevronLeft className="size-4" /></span>
          </div>
        </a>
      </Container>
    </section>
  );
}

export function Blog() {
  return (
    <section id="blog" className="py-4">
      <Container>
        <SectionHeader title="آخرین وبلاگ‌ها" href="/blog" />
        <div className="grid gap-3 md:grid-cols-3">
          {blogPosts2.slice(0, 3).map((b) => (
            <Link key={b.slug} href="/blog" className="flex min-h-36 flex-col gap-3 rounded-xl border border-border bg-surface-2 p-4 transition-shadow hover:shadow-md">
              <div className="flex items-center justify-between text-[11px] text-muted"><span className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary">{b.cat}</span><span>{b.date}</span></div>
              <h3 className="line-clamp-2 text-sm font-black leading-7">{b.title}</h3>
              <span className="mt-auto text-[11px] font-bold text-primary">ادامه مطلب ‹</span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
