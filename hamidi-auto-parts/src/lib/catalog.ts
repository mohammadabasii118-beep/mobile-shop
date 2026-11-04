import { PRODUCTS, fitsVehicle, type Product } from "@/data/products";
import { getCategory } from "@/data/categories";
import { getBrand, getModel } from "@/data/vehicles";
import { normalize } from "@/lib/utils";

export type SortKey = "popular" | "newest" | "price-asc" | "price-desc" | "discount";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "popular", label: "پرفروش‌ترین" },
  { value: "newest", label: "جدیدترین" },
  { value: "price-asc", label: "ارزان‌ترین" },
  { value: "price-desc", label: "گران‌ترین" },
  { value: "discount", label: "بیشترین تخفیف" },
];

export interface CatalogFilters {
  q?: string;
  brand?: string;
  model?: string;
  year?: number;
  categories?: string[];
  inStock?: boolean;
  sort?: SortKey;
}

function haystack(p: Product) {
  const models = p.fitments.map((f) => {
    const m = getModel(f.model);
    return m ? `${m.nameFa} ${m.nameEn}` : f.model;
  });
  return normalize(
    [p.name, p.nameEn, p.sku, p.oem, p.oem.replace(/-/g, ""), p.manufacturer, getCategory(p.category)?.nameFa,
      getBrand(p.brand)?.nameFa, p.brand, ...models].join(" "),
  );
}

const INDEX = new Map(PRODUCTS.map((p) => [p.id, haystack(p)]));

export function matchesQuery(p: Product, q: string) {
  const terms = normalize(q).split(" ").filter(Boolean);
  if (!terms.length) return true;
  const text = INDEX.get(p.id) ?? "";
  const compact = text.replace(/\s/g, "");
  return terms.every((t) => text.includes(t) || compact.includes(t.replace(/-/g, "")));
}

export function queryProducts(f: CatalogFilters): Product[] {
  let list = PRODUCTS.filter(
    (p) =>
      (!f.q || matchesQuery(p, f.q)) &&
      (!f.brand || p.brand === f.brand) &&
      fitsVehicle(p, f.model, f.year) &&
      (!f.categories?.length || f.categories.includes(p.category)) &&
      (!f.inStock || p.stock !== "out-of-stock"),
  );
  const sort = f.sort ?? "popular";
  list = [...list].sort((a, b) => {
    switch (sort) {
      case "price-asc": return a.price - b.price;
      case "price-desc": return b.price - a.price;
      case "newest": return b.addedAt.localeCompare(a.addedAt);
      case "discount": return (b.oldPrice ? 1 - b.price / b.oldPrice : 0) - (a.oldPrice ? 1 - a.price / a.oldPrice : 0);
      default: return b.sold - a.sold;
    }
  });
  // out-of-stock items always go last
  return list.sort((a, b) => Number(a.stock === "out-of-stock") - Number(b.stock === "out-of-stock"));
}

export const bestsellers = () => [...PRODUCTS].filter((p) => p.badges.includes("bestseller")).sort((a, b) => b.sold - a.sold);
export const newest = () => [...PRODUCTS].filter((p) => p.badges.includes("new")).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
export const specials = () => PRODUCTS.filter((p) => p.badges.includes("special") && p.oldPrice);
export const countByCategory = (id: string) => PRODUCTS.filter((p) => p.category === id).length;
export const countByModel = (id: string) => PRODUCTS.filter((p) => p.fitments.some((f) => f.model === id)).length;
