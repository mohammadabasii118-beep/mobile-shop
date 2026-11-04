import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, toFa } from "@/lib/utils";

/** Crawlable numbered pagination (plain links, works without JavaScript). */
export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  const item = "grid h-10 min-w-10 place-items-center rounded-xl border px-3 text-sm font-semibold transition";
  return (
    <nav aria-label="صفحه‌بندی محصولات" className="mt-10 flex justify-center">
      <ul className="flex items-center gap-1.5">
        <li>
          {page > 1 ? (
            <Link prefetch={false} href={hrefFor(page - 1)} rel="prev" className={cn(item, "border-neutral-200 hover:border-neutral-950")} aria-label="صفحه قبل"><ChevronRight className="size-4" /></Link>
          ) : <span className={cn(item, "border-neutral-100 text-neutral-300")} aria-hidden><ChevronRight className="size-4" /></span>}
        </li>
        {nums.map((n, i) => (
          <li key={n} className="flex items-center gap-1.5">
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-neutral-500">…</span>}
            <Link prefetch={false} href={hrefFor(n)} aria-current={n === page ? "page" : undefined} className={cn(item, n === page ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 hover:border-neutral-950")}>
              {toFa(n)}
            </Link>
          </li>
        ))}
        <li>
          {page < pages ? (
            <Link prefetch={false} href={hrefFor(page + 1)} rel="next" className={cn(item, "border-neutral-200 hover:border-neutral-950")} aria-label="صفحه بعد"><ChevronLeft className="size-4" /></Link>
          ) : <span className={cn(item, "border-neutral-100 text-neutral-300")} aria-hidden><ChevronLeft className="size-4" /></span>}
        </li>
      </ul>
    </nav>
  );
}
