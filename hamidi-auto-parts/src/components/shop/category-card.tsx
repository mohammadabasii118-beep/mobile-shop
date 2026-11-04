import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Category } from "@/data/categories";
import { countByCategory } from "@/lib/catalog";
import { cn, toFa } from "@/lib/utils";

export function CategoryCard({ c, className, large }: { c: Category; className?: string; large?: boolean }) {
  return (
    <Link
      href={`/categories/${c.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-neutral-950 hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,.35)]",
        className,
      )}
    >
      <div className={cn("relative bg-studio", large ? "aspect-[4/3]" : "aspect-square")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.image} alt={c.nameFa} loading="lazy" className="size-full object-contain p-[14%] transition duration-500 group-hover:scale-110" />
        <span className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-lg bg-white/90 text-neutral-700 shadow-sm transition group-hover:bg-primary group-hover:text-white">
          <c.icon className="size-4" />
        </span>
      </div>
      <div className="flex flex-1 items-center justify-between gap-2 p-3 sm:p-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold">{c.nameFa}</h3>
          <p className="mt-0.5 text-[11px] text-neutral-500">{toFa(countByCategory(c.id))} محصول</p>
          {large && <p className="mt-2 line-clamp-2 text-xs leading-6 text-neutral-500">{c.description}</p>}
        </div>
        <ArrowLeft className="size-4 shrink-0 text-neutral-300 transition group-hover:-translate-x-1 group-hover:text-primary" />
      </div>
    </Link>
  );
}
