import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { toFa } from "@/lib/utils";
import type { CardProduct } from "@/lib/types";

export function Crumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="مسیر" className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && "‹"}
          {c.href ? <Link href={c.href} className="hover:text-primary">{c.name}</Link> : <span aria-current="page">{c.name}</span>}
        </span>
      ))}
    </nav>
  );
}

export function ProductGrid({ items }: { items: CardProduct[] }) {
  if (items.length === 0) return <p className="py-12 text-center text-sm text-muted">فعلاً محصولی در این بخش موجود نیست.</p>;
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.map((p) => <ProductCard key={p.id} p={p} showCat />)}</div>;
}

/** Numbered, crawlable pagination (real links, not JS). */
export function Pagination({ basePath, page, pages }: { basePath: string; page: number; pages: number }) {
  if (pages <= 1) return null;
  const href = (n: number) => (n === 1 ? basePath : `${basePath}?page=${n}`);
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2);
  return (
    <nav aria-label="صفحه‌بندی" className="mt-6 flex flex-wrap items-center justify-center gap-1.5 text-xs">
      {page > 1 && <Link rel="prev" href={href(page - 1)} className="rounded-lg border border-border px-3 py-2 hover:border-primary">قبلی</Link>}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && nums[i - 1]! < n - 1 && <span className="text-muted">…</span>}
          <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={n === page ? "rounded-lg bg-primary px-3 py-2 font-bold text-primary-fg" : "rounded-lg border border-border px-3 py-2 hover:border-primary"}>{toFa(n)}</Link>
        </span>
      ))}
      {page < pages && <Link rel="next" href={href(page + 1)} className="rounded-lg border border-border px-3 py-2 hover:border-primary">بعدی</Link>}
    </nav>
  );
}

export function ChipLinks({ title, items }: { title: string; items: { label: string; href: string }[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title} className="mt-6">
      <h2 className="mb-2 text-sm font-black">{title}</h2>
      <div className="flex flex-wrap gap-2">{items.map((c) => <Link key={c.href} href={c.href} className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium hover:border-primary hover:text-primary">{c.label}</Link>)}</div>
    </section>
  );
}

/** Admin-written SEO copy (Category.seoContent). Rendered as escaped paragraphs; nothing is generated. */
export function SeoText({ text }: { text: string | null | undefined }) {
  if (!text?.trim()) return null;
  return <section className="mt-8 space-y-3 rounded-2xl border border-border bg-surface p-5 text-[13px] leading-8">{text.split(/\n{2,}/).map((b, i) => <p key={i}>{b}</p>)}</section>;
}
