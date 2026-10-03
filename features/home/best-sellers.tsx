"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { products } from "@/data/mock";
import { ProductCard } from "@/features/catalog/product-card";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/utils";

const FILTERS = [
  { id: "all", label: "همه" },
  { id: "cases", label: "قاب" },
  { id: "charging", label: "شارژ و کابل" },
  { id: "audio", label: "صوتی" },
  { id: "protection", label: "محافظ" },
];

export function BestSellers() {
  const [filter, setFilter] = useState("all");
  const list = useMemo(() => (filter === "all" ? products : products.filter((p) => p.categoryId === filter)), [filter]);

  return (
    <section id="best-sellers" className="bg-bg pb-section">
      <div className="container-x">
        <SectionHeader eyebrow="پرفروش‌ها" title="آنچه این هفته بیشتر خریده شد" />
        <div role="tablist" aria-label="فیلتر دسته" className="no-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "relative min-h-11 shrink-0 rounded-full px-5 text-sm font-semibold transition-colors",
                filter === f.id ? "text-primary-fg" : "bg-secondary text-fg hover:bg-line",
              )}
            >
              {filter === f.id && <motion.span layoutId="chip" className="absolute inset-0 rounded-full bg-primary" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
              <span className="relative">{f.label}</span>
            </button>
          ))}
        </div>

        <motion.ul layout className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {list.map((p) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <ProductCard product={p} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      </div>
    </section>
  );
}
