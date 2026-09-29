"use client";
import { useId, useRef } from "react";
import Link from "next/link";
import ProductCard, { ProductCardData } from "./ProductCard";

export default function ProductRail({
  title,
  products,
  viewAllHref,
}: {
  title: string;
  products: ProductCardData[];
  viewAllHref?: string;
}) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);

  if (!products.length) return null;

  function scroll(dir: "prev" | "next") {
    ref.current?.scrollBy({ left: dir === "next" ? -320 : 320, behavior: "smooth" });
  }

  return (
    <section className="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <div className="flex items-end justify-between mb-5">
        <h2 className="text-lg md:text-xl font-bold">{title}</h2>
        <div className="flex items-center gap-4">
          {viewAllHref && (
            <Link href={viewAllHref} className="text-xs font-medium" style={{ color: "#404040" }}>
              مشاهده همه
            </Link>
          )}
          <div className="hidden md:flex items-center gap-2">
            <button onClick={() => scroll("prev")} aria-label="قبلی" className="w-8 h-8 rounded-full border line flex items-center justify-center text-sm">→</button>
            <button onClick={() => scroll("next")} aria-label="بعدی" className="w-8 h-8 rounded-full border line flex items-center justify-center text-sm">←</button>
          </div>
        </div>
      </div>
      <div ref={ref} id={id} className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory pb-1">
        {products.map((p) => (
          <div key={p.id} className="snap-start shrink-0 w-[44%] sm:w-[30%] md:w-[22%] lg:w-[18%]">
            <ProductCard p={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
