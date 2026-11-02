"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { products, categories } from "@/lib/products";
import ProductCard from "./ProductCard";
import { toFa, formatPrice } from "@/lib/format";

type Sort = "relevance" | "cheap" | "expensive" | "rating" | "discount";

const SORTS: { value: Sort; label: string }[] = [
  { value: "relevance", label: "پیش‌فرض" },
  { value: "cheap", label: "ارزان‌ترین" },
  { value: "expensive", label: "گران‌ترین" },
  { value: "rating", label: "محبوب‌ترین" },
  { value: "discount", label: "بیشترین تخفیف" },
];

function discountOf(p: (typeof products)[number]) {
  return p.oldPrice ? 1 - p.price / p.oldPrice : 0;
}

export default function ProductsBrowser() {
  const sp = useSearchParams();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("relevance");
  const [onlyOffers, setOnlyOffers] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // sync from URL on mount / when params change
  useEffect(() => {
    const c = sp.get("cat");
    const s = sp.get("sort");
    const query = sp.get("q");
    if (c) setCat(c);
    if (query) setQ(query);
    if (s === "discount") {
      setSort("discount");
      setOnlyOffers(true);
    } else if (s === "rating" || s === "bestseller") setSort("rating");
    else if (s === "newest") setSort("relevance");
  }, [sp]);

  const list = useMemo(() => {
    let r = [...products];
    if (cat !== "all") r = r.filter((p) => p.categorySlug === cat);
    if (onlyOffers) r = r.filter((p) => p.badges.includes("offer"));
    if (q.trim()) {
      const term = q.trim();
      r = r.filter(
        (p) =>
          p.name.includes(term) ||
          p.shortDesc.includes(term) ||
          p.description.includes(term)
      );
    }
    switch (sort) {
      case "cheap":
        r.sort((a, b) => a.price - b.price);
        break;
      case "expensive":
        r.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        r.sort((a, b) => b.rating - a.rating);
        break;
      case "discount":
        r.sort((a, b) => discountOf(b) - discountOf(a));
        break;
    }
    return r;
  }, [cat, q, sort, onlyOffers]);

  const activeCat = categories.find((c) => c.slug === cat);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* heading */}
      <div className="mb-6">
        <nav className="mb-2 text-xs text-silver-500">
          خانه / فروشگاه {activeCat ? `/ ${activeCat.name}` : ""}
        </nav>
        <h1 className="text-2xl font-black text-silver-50 sm:text-3xl">
          {activeCat ? activeCat.name : "همه‌ی محصولات"}
        </h1>
        <p className="mt-1 text-sm text-silver-400">
          {toFa(list.length)} محصول یافت شد
        </p>
      </div>

      {/* search + sort bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو در محصولات…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pr-10 pl-3 text-sm text-silver-100 outline-none placeholder:text-silver-500 focus:border-white/25"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-silver-100 outline-none focus:border-white/25"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="btn-ghost px-4 py-3 lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            فیلتر
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* filters */}
        <aside
          className={`${
            filtersOpen ? "block" : "hidden"
          } space-y-6 lg:block`}
        >
          <div className="glass rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-silver-100">دسته‌بندی</h3>
              {cat !== "all" && (
                <button
                  onClick={() => setCat("all")}
                  className="text-[11px] text-accent"
                >
                  حذف
                </button>
              )}
            </div>
            <div className="space-y-1">
              <button
                onClick={() => setCat("all")}
                className={`block w-full rounded-lg px-3 py-2 text-right text-sm transition ${
                  cat === "all"
                    ? "bg-white/10 text-white"
                    : "text-silver-300 hover:bg-white/5"
                }`}
              >
                همه
              </button>
              {categories.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => setCat(c.slug)}
                  className={`block w-full rounded-lg px-3 py-2 text-right text-sm transition ${
                    cat === c.slug
                      ? "bg-white/10 text-white"
                      : "text-silver-300 hover:bg-white/5"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-4">
            <h3 className="mb-3 text-sm font-bold text-silver-100">فیلترها</h3>
            <label className="flex cursor-pointer items-center justify-between py-1 text-sm text-silver-300">
              فقط تخفیف‌دارها
              <input
                type="checkbox"
                checked={onlyOffers}
                onChange={(e) => setOnlyOffers(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
            </label>
          </div>
        </aside>

        {/* grid */}
        <div>
          {list.length === 0 ? (
            <div className="glass grid place-items-center rounded-2xl py-20 text-center">
              <X className="mb-3 h-10 w-10 text-silver-500" />
              <p className="text-silver-300">محصولی با این مشخصات پیدا نشد.</p>
              <button
                onClick={() => {
                  setQ("");
                  setCat("all");
                  setOnlyOffers(false);
                }}
                className="btn-ghost mt-4"
              >
                پاک کردن فیلترها
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
              {list.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
