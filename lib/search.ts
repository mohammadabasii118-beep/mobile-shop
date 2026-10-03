import { categories, products } from "@/data/mock";

/** نرمال‌سازی فارسی؛ نقطهٔ توسعهٔ typo tolerance و جستجوی فازی در آینده */
export function normalizeFa(input: string) {
  return input
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ً-ٟـ]/g, "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .toLowerCase()
    .trim();
}

export const POPULAR_SEARCHES = ["قاب iPhone 17 Pro", "شارژر مگنتی", "ایربادز", "پاوربانک", "کابل USB-C"];

export function searchCatalog(query: string) {
  const q = normalizeFa(query);
  if (!q) return { products: [], categories: [], brands: [] };
  const hit = (s: string) => normalizeFa(s).includes(q);
  const ps = products.filter((p) => hit(p.name) || hit(p.brand) || p.compatibility.some(hit)).slice(0, 4);
  const cs = categories.filter((c) => hit(c.name)).slice(0, 3);
  const brands = [...new Set(products.map((p) => p.brand))].filter(hit).slice(0, 3);
  return { products: ps, categories: cs, brands };
}
