"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "@/data/products";
import { ProductCard } from "./product-card";
import { cn } from "@/lib/utils";

export function ProductRail({ products, dark }: { products: Product[]; dark?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };
  const btn = cn(
    "absolute top-1/3 z-10 hidden size-11 cursor-pointer place-items-center rounded-full shadow-lg transition md:grid",
    dark ? "bg-white text-neutral-950 hover:bg-primary hover:text-white" : "bg-neutral-950 text-white hover:bg-primary",
  );
  return (
    <div className="relative">
      <button aria-label="قبلی" onClick={() => scroll(1)} className={cn(btn, "-right-5")}><ChevronRight className="size-5" /></button>
      <button aria-label="بعدی" onClick={() => scroll(-1)} className={cn(btn, "-left-5")}><ChevronLeft className="size-5" /></button>
      <div ref={ref} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pt-1 pb-6 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} className="w-[78%] shrink-0 snap-start min-[480px]:w-[46%] md:w-[31%] xl:w-[calc(25%-12px)]" />
        ))}
      </div>
    </div>
  );
}
