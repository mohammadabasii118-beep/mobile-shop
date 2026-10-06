import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { Container, SectionHeader } from "@/components/ui";
import { ProductCard } from "@/components/product-card";
import { ProductVisual } from "@/components/product-visual";
import { toFa } from "@/lib/utils";
import type { CardProduct } from "@/lib/types";

/** Brand index: a calm strip of the brands in the catalogue (no scrolling ticker). */
export function BrandMarquee({ brands }: { brands: string[] }) {
  if (!brands.length) return null;
  return (
    <section className="border-b border-border" aria-label="برندها">
      <Container className="flex items-center gap-6 py-5">
        <span className="shrink-0 text-[12px] font-bold text-muted">برندها</span>
        <ul dir="ltr" className="no-scrollbar flex min-w-0 flex-1 items-center gap-x-9 overflow-x-auto whitespace-nowrap text-[13px] font-bold uppercase tracking-[0.16em] text-foreground/80">
          {brands.map((b) => <li key={b} className="shrink-0">{b}</li>)}
        </ul>
      </Container>
    </section>
  );
}

/** A product row. The first row of the page uses the "feature" layout: an ink panel with the title next to a four-up grid. */
export function ProductRail({ id, title, items, href, feature }: { id: string; title: string; items: CardProduct[]; href: string; feature?: boolean }) {
  if (!items.length) return null;
  if (feature) {
    return (
      <section id={id} className="scroll-mt-24 py-10 sm:py-16">
        <Container className="grid gap-6 lg:grid-cols-[300px_1fr] lg:gap-10">
          <div className="flex flex-col justify-between gap-6 rounded-[16px] bg-secondary p-6 text-secondary-fg sm:p-8">
            <div>
              <p className="text-[12px] font-bold tracking-wide text-secondary-fg/60">منتخب کیس‌لاین</p>
              <h2 className="font-display mt-3 text-[40px] leading-[1.05] sm:text-[52px]">{title}</h2>
              <p className="mt-4 max-w-[16rem] text-[13px] leading-7 text-secondary-fg/70">{toFa(items.length)} محصول از پرفروش‌ترین‌ها، با ارسال سریع و ضمانت اصالت.</p>
            </div>
            <Link href={href} className="inline-flex h-12 w-fit items-center gap-2 rounded-md bg-accent px-5 text-[14px] font-semibold text-accent-fg transition-opacity hover:opacity-90">مشاهده همه <ArrowLeft className="size-4" /></Link>
          </div>
          <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-x-5 sm:gap-y-8 sm:overflow-visible sm:px-0 xl:grid-cols-4">
            {items.slice(0, 4).map((p) => <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-auto"><ProductCard p={p} /></div>)}
          </div>
        </Container>
      </section>
    );
  }
  return (
    <section id={id} className="scroll-mt-24 py-10 sm:py-14">
      <Container>
        <SectionHeader title={title} href={href} />
        <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-x-5 sm:gap-y-8 sm:overflow-visible sm:px-0 lg:grid-cols-5">
          {items.map((p) => <div key={p.id} className="w-[44%] shrink-0 snap-start sm:w-auto"><ProductCard p={p} /></div>)}
        </div>
      </Container>
    </section>
  );
}

const tileHues = [14, 200, 30];

/** Category index: numbered, typographic tiles. Each one links to the shop section for that category. */
export function CategoryTiles({ title, categories }: { title: string; categories: { slug: string; label: string; productCount: number; sampleKinds: string[] }[] }) {
  return (
    <section className="py-10 sm:py-16">
      <Container>
        <SectionHeader title={title} />
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-border bg-border lg:grid-cols-6" data-category-rail>
          {categories.map((c, n) => (
            <Link key={c.slug} href={`/shop#${c.slug}`} className={`group relative flex min-h-[168px] flex-col justify-between gap-6 bg-background p-5 transition-colors duration-200 hover:bg-card sm:min-h-[200px] ${n === 0 ? "col-span-2 lg:col-span-2" : "lg:col-span-1"} ${n === categories.length - 1 && categories.length % 2 === 0 && n !== 0 ? "" : ""}`}>
              <span className="flex items-start justify-between">
                <span className="num text-[12px] font-bold text-muted">{toFa(n + 1).padStart(2, "۰")}</span>
                <span className="flex gap-1" dir="rtl">
                  {c.sampleKinds.slice(0, n === 0 ? 3 : 2).map((k, i) => <span key={i} className="grid size-9 place-items-center rounded-[8px] bg-surface-2"><ProductVisual kind={k} hue={tileHues[i % 3]} className="size-6" /></span>)}
                </span>
              </span>
              <span className="block">
                <span className={`font-display block leading-[1.1] ${n === 0 ? "text-[34px] sm:text-[40px]" : "text-[26px]"}`}>{c.label}</span>
                <span className="mt-1.5 flex items-center justify-between text-[12px] text-muted"><span className="num">{toFa(c.productCount)} محصول</span><ArrowLeft className="size-4 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden /></span>
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}

/** Promotional strip (the Telegram banner managed in the admin): ink band, one line of copy, one action. */
export function TelegramBanner({ title, subtitle, buttonText, link }: { title: string; subtitle?: string | null; buttonText?: string | null; link?: string | null }) {
  return (
    <section className="py-10 sm:py-16">
      <Container>
        <a href={link ?? "#"} target="_blank" rel="noopener noreferrer" className="group relative flex flex-col gap-6 overflow-hidden rounded-[16px] bg-secondary p-7 text-secondary-fg sm:flex-row sm:items-center sm:justify-between sm:p-12">
          <svg className="pointer-events-none absolute -start-10 -top-10 size-64 text-secondary-fg/[0.06]" viewBox="0 0 100 100" fill="none" aria-hidden><circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="1" /><circle cx="50" cy="50" r="34" stroke="currentColor" strokeWidth="1" /><circle cx="50" cy="50" r="20" stroke="currentColor" strokeWidth="1" /></svg>
          <div className="relative max-w-[34rem]">
            <p className="text-[12px] font-bold tracking-wide text-accent">{title}</p>
            {subtitle && <p className="font-display mt-3 text-[34px] leading-[1.15] sm:text-[46px]">{subtitle}</p>}
          </div>
          {buttonText && <span className="relative inline-flex h-12 w-fit items-center gap-2.5 rounded-md bg-accent px-6 text-[14px] font-semibold text-accent-fg transition-transform duration-200 group-hover:-translate-y-0.5"><Send className="size-4 -scale-x-100" />{buttonText}</span>}
        </a>
      </Container>
    </section>
  );
}

export function BlogSection({ title, posts }: { title: string; posts: { slug: string; title: string; category: string | null; date: string }[] }) {
  return (
    <section id="blog" className="py-10 sm:py-16">
      <Container>
        <SectionHeader title={title} href="/blog" />
        {/* Mobile: one swipeable rail; from md: three columns separated by hairlines. */}
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:gap-0 md:overflow-visible md:px-0" data-blog-rail>
          {posts.map((b) => (
            <Link key={b.slug} href={`/blog/${b.slug}`} className="group flex min-h-44 w-[78%] shrink-0 snap-start flex-col gap-4 rounded-[10px] border border-border bg-card p-5 transition-colors hover:border-foreground md:w-auto md:rounded-none md:border-0 md:border-s md:border-border md:bg-transparent md:px-8 md:first:border-s-0 md:first:ps-0 md:last:pe-0">
              <div className="flex items-center justify-between gap-3 text-[12px] text-muted"><span className="font-bold text-primary">{b.category}</span><span className="num">{b.date}</span></div>
              <h3 className="font-display line-clamp-3 text-[24px] leading-[1.3]">{b.title}</h3>
              <span className="mt-auto inline-flex items-center gap-1.5 text-[13px] font-semibold">ادامه مطلب <ArrowLeft className="size-3.5 transition-transform duration-200 group-hover:-translate-x-1" /></span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
