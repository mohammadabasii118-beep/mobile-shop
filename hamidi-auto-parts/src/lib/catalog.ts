import "server-only";
import { cache } from "react";
import { PRODUCTS, fitsVehicle, slugify, type Product } from "@/data/products";
import { getCategory } from "@/data/categories";
import { getBrand, getModel } from "@/data/vehicles";
import { normalize } from "@/lib/utils";
import type { CartItem } from "@/lib/cart-item";

/*
 * Catalogue repository. Every page reads products through these functions only,
 * so the in-memory demo data can later be swapped for a database / search
 * engine (Postgres, Meilisearch, …) without touching any page or component.
 */

export type SortKey = "popular" | "newest" | "price-asc" | "price-desc" | "discount";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "popular", label: "پرفروش‌ترین" },
  { value: "newest", label: "جدیدترین" },
  { value: "price-asc", label: "ارزان‌ترین" },
  { value: "price-desc", label: "گران‌ترین" },
  { value: "discount", label: "بیشترین تخفیف" },
];

export const PRICE_RANGES = [
  { id: "0-1m", label: "تا ۱ میلیون", min: 0, max: 1_000_000 },
  { id: "1m-5m", label: "۱ تا ۵ میلیون", min: 1_000_000, max: 5_000_000 },
  { id: "5m-20m", label: "۵ تا ۲۰ میلیون", min: 5_000_000, max: 20_000_000 },
  { id: "20m-plus", label: "بیش از ۲۰ میلیون", min: 20_000_000, max: Number.POSITIVE_INFINITY },
];

export const PAGE_SIZE = 24;

export interface Scope {
  brand?: string;
  model?: string;
  category?: string;
  q?: string;
}

export interface ListingParams {
  cats: string[];
  brand?: string;
  year?: number;
  price?: string;
  inStock: boolean;
  sort: SortKey;
  page: number;
  /** true when any parameter other than `page` is set → page must not be indexed */
  filtered: boolean;
}

type RawParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseListingParams(sp: RawParams): ListingParams {
  const sort = one(sp.sort) as SortKey | undefined;
  const page = Number(one(sp.page) ?? 1);
  const year = Number(one(sp.year));
  const cats = (one(sp.cat) ?? "").split(",").filter((c) => !!getCategory(c));
  const price = PRICE_RANGES.some((r) => r.id === one(sp.price)) ? one(sp.price) : undefined;
  const brand = getBrand(one(sp.brand) ?? "") ? one(sp.brand) : undefined;
  const p: ListingParams = {
    cats,
    brand,
    year: Number.isInteger(year) && year > 1980 && year < 2100 ? year : undefined,
    price,
    inStock: one(sp.stock) === "1",
    sort: SORT_OPTIONS.some((o) => o.value === sort) ? sort! : "popular",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    filtered: false,
  };
  p.filtered = !!(p.cats.length || p.brand || p.year || p.price || p.inStock || p.sort !== "popular");
  return p;
}

/* ---------- search index (built once per server instance) ---------- */

const INDEX = new Map(
  PRODUCTS.map((p) => {
    const models = p.fitments.map((f) => {
      const m = getModel(f.model);
      return m ? `${m.nameFa} ${m.nameEn}` : f.model;
    });
    const text = normalize(
      [p.name, p.nameEn, p.sku, p.oem, p.manufacturer, getCategory(p.category)?.nameFa, getBrand(p.brand)?.nameFa, p.brand, ...models].join(" "),
    );
    return [p.id, { text, compact: text.replace(/[\s-]/g, "") }];
  }),
);

function matchesQuery(p: Product, q: string) {
  const terms = normalize(q).split(" ").filter(Boolean);
  const idx = INDEX.get(p.id)!;
  return terms.every((t) => idx.text.includes(t) || idx.compact.includes(t.replace(/-/g, "")));
}

function inScope(p: Product, s: Scope) {
  return (
    (!s.brand || p.brand === s.brand) &&
    (!s.category || p.category === s.category) &&
    fitsVehicle(p, s.model) &&
    (!s.q || matchesQuery(p, s.q))
  );
}

const sorters: Record<SortKey, (a: Product, b: Product) => number> = {
  popular: (a, b) => b.sold - a.sold,
  newest: (a, b) => b.addedAt.localeCompare(a.addedAt),
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
  discount: (a, b) => (b.oldPrice ? 1 - b.price / b.oldPrice : 0) - (a.oldPrice ? 1 - a.price / a.oldPrice : 0),
};

export const listProducts = cache((scope: Scope, params: ListingParams, pageSize = PAGE_SIZE) => {
  const range = PRICE_RANGES.find((r) => r.id === params.price);
  const all = PRODUCTS.filter(
    (p) =>
      inScope(p, scope) &&
      (!params.brand || p.brand === params.brand) &&
      (!params.cats.length || params.cats.includes(p.category)) &&
      (!params.year || fitsVehicle(p, scope.model, params.year)) &&
      (!params.inStock || p.stock !== "out-of-stock") &&
      (!range || (p.price >= range.min && p.price < range.max)),
  )
    .sort(sorters[params.sort])
    // out-of-stock items always last
    .sort((a, b) => Number(a.stock === "out-of-stock") - Number(b.stock === "out-of-stock"));
  const pages = Math.max(1, Math.ceil(all.length / pageSize));
  const start = (params.page - 1) * pageSize;
  return { items: all.slice(start, start + pageSize), total: all.length, pages, page: params.page };
});

/** product counts per category inside a scope — used for filter facets and internal links */
export const categoryFacets = cache((scope: Scope) => {
  const counts = new Map<string, number>();
  for (const p of PRODUCTS) if (inScope(p, scope)) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  return counts;
});

export const modelFacets = cache((scope: Scope) => {
  const counts = new Map<string, number>();
  for (const p of PRODUCTS) if (inScope(p, scope)) for (const f of p.fitments) counts.set(f.model, (counts.get(f.model) ?? 0) + 1);
  return counts;
});

export const countProducts = (scope: Scope = {}) => PRODUCTS.filter((p) => inScope(p, scope)).length;

/* ---------- single products ---------- */

const BY_SLUG = new Map(PRODUCTS.map((p) => [p.slug, p]));
const BY_SKU = new Map(PRODUCTS.map((p) => [slugify(p.sku), p]));

/**
 * Resolves a product URL. Returns `redirect` when the slug is an old/alternate
 * form (e.g. only the SKU) so the page can 308 to the canonical URL and avoid
 * duplicate content.
 */
export const resolveProduct = cache((slug: string): { product?: Product; redirect?: string } => {
  const exact = BY_SLUG.get(slug);
  if (exact) return { product: exact };
  const lower = slug.toLowerCase();
  const bySku = BY_SKU.get(lower) ?? [...BY_SKU.entries()].find(([sku]) => lower.endsWith(`-${sku}`))?.[1];
  return bySku ? { redirect: productPath(bySku) } : {};
});

export const allProducts = () => PRODUCTS;
export const productPath = (p: Pick<Product, "slug">) => `/product/${p.slug}`;
export const modelPath = (brand: string, model: string) => `/${brand}/${model}`;
export const categoryPath = (id: string) => `/categories/${id}`;

export const bestsellers = (limit = 10) => [...PRODUCTS].filter((p) => p.badges.includes("bestseller")).sort((a, b) => b.sold - a.sold).slice(0, limit);
export const newest = (limit = 8) => [...PRODUCTS].filter((p) => p.badges.includes("new")).sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, limit);
export const specials = (limit = 8) => PRODUCTS.filter((p) => p.badges.includes("special") && p.oldPrice).slice(0, limit);

export const relatedProducts = cache((p: Product, limit = 10) => {
  const models = new Set(p.fitments.map((f) => f.model));
  return PRODUCTS.filter((x) => x.id !== p.id)
    .map((x) => ({
      x,
      score: (x.category === p.category ? 3 : 0) + (x.fitments.some((f) => models.has(f.model)) ? 2 : 0) + (x.brand === p.brand ? 1 : 0),
    }))
    .filter((r) => r.score >= 2)
    .sort((a, b) => b.score - a.score || b.x.sold - a.x.sold)
    .slice(0, limit)
    .map((r) => r.x);
});

/** Lightweight, serialisable snapshot passed to the client-side cart. */
export function toCartItem(p: Product): CartItem {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    sku: p.sku,
    oem: p.oem,
    image: p.image,
    price: p.price,
    oldPrice: p.oldPrice,
    maxQty: Math.max(1, Math.min(20, p.stockQty)),
    fits: p.fitments.slice(0, 3).map((f) => getModel(f.model)?.nameFa ?? f.model).join("، "),
    available: p.stock !== "out-of-stock",
  };
}

/** Live-search payload (used by /api/search). */
export function searchSuggestions(q: string, limit = 6) {
  if (normalize(q).length < 2) return { total: 0, items: [] };
  const hits = PRODUCTS.filter((p) => matchesQuery(p, q)).sort((a, b) => b.sold - a.sold);
  return {
    total: hits.length,
    items: hits.slice(0, limit).map((p) => ({
      href: productPath(p),
      name: p.name,
      sku: p.sku,
      image: p.image,
      price: p.price,
      category: getCategory(p.category)?.nameFa ?? "",
    })),
  };
}
