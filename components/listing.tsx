import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { toFa } from "@/lib/utils";
import type { CardProduct } from "@/lib/types";

export function Crumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="مسیر" className="mb-4 flex flex-wrap items-center gap-2 text-[12px] text-muted">
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden className="text-border-strong">/</span>}
          {c.href ? <Link href={c.href} className="transition-colors hover:text-primary">{c.name}</Link> : <span aria-current="page" className="text-foreground">{c.name}</span>}
        </span>
      ))}
    </nav>
  );
}

export function ProductGrid({ items }: { items: CardProduct[] }) {
  if (items.length === 0) return (
    <div className="mx-auto my-16 max-w-sm text-center">
      <p className="font-display text-[28px] leading-tight">فعلاً محصولی در این بخش موجود نیست</p>
      <p className="mt-2 text-[13px] text-muted">به‌زودی محصولات تازه اضافه می‌شود. تا آن موقع فروشگاه را ببینید.</p>
      <Link href="/shop" className="mt-5 inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-fg hover:bg-primary-hover">مشاهده فروشگاه</Link>
    </div>
  );
  return <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 lg:grid-cols-4">{items.map((p) => <ProductCard key={p.id} p={p} showCat />)}</div>;
}

/** Numbered, crawlable pagination (real links, not JS). */
export function Pagination({ basePath, page, pages }: { basePath: string; page: number; pages: number }) {
  if (pages <= 1) return null;
  const href = (n: number) => (n === 1 ? basePath : `${basePath}?page=${n}`);
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2);
  const box = "grid h-11 min-w-11 place-items-center rounded-md border px-3 text-[13px] font-semibold transition-colors";
  return (
    <nav aria-label="صفحه‌بندی" className="mt-12 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && <Link rel="prev" href={href(page - 1)} className={`${box} border-border-strong hover:border-foreground`}>قبلی</Link>}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          {i > 0 && nums[i - 1]! < n - 1 && <span className="text-muted">…</span>}
          <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={n === page ? `${box} num border-foreground bg-foreground text-background` : `${box} num border-border-strong hover:border-foreground`}>{toFa(n)}</Link>
        </span>
      ))}
      {page < pages && <Link rel="next" href={href(page + 1)} className={`${box} border-border-strong hover:border-foreground`}>بعدی</Link>}
    </nav>
  );
}

export function ChipLinks({ title, items }: { title: string; items: { label: string; href: string }[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title} className="mt-8">
      <h2 className="mb-3 text-[12px] font-bold tracking-wide text-muted">{title}</h2>
      <div className="flex flex-wrap gap-2">{items.map((c) => <Link key={c.href} href={c.href} className="rounded-full border border-border-strong bg-card px-4 py-2 text-[13px] font-medium transition-colors hover:border-foreground">{c.label}</Link>)}</div>
    </section>
  );
}

/** Admin-written SEO copy (Category.seoContent). Rendered as escaped paragraphs; nothing is generated. */
export function SeoText({ text }: { text: string | null | undefined }) {
  if (!text?.trim()) return null;
  return <section className="mt-14 max-w-3xl space-y-4 border-t border-border pt-8 text-[14px] leading-8 text-foreground/85">{text.split(/\n{2,}/).map((b, i) => <p key={i}>{b}</p>)}</section>;
}
