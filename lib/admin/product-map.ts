import type { ProductData } from "@/components/admin/product-form";

interface ApiProduct {
  id: string; name: string; slug: string; sku: string; brandId: string | null; categoryId: string; shortDescription: string | null; description: string | null; badge: string | null; isActive: boolean;
  retailPrice: number; retailDiscount: number; wholesalePrice: number | null; wholesaleDiscount: number; minWholesaleQty: number; seoTitle: string | null; seoDescription: string | null; canonical: string | null;
  phoneModelIds: string[]; images: { url: string; alt: string | null }[];
  variants: { id: string; sku: string; name: string; color: string | null; colorHex: string | null; retailPrice: number | null; wholesalePrice: number | null; isActive: boolean; inventory: { quantity: number } | null }[];
  priceHistory: { id: string; type: string; oldPrice: number; newPrice: number; createdAt: string | Date }[];
}

/** API/DB product → editable form state (shared by the server page and the client after saving). */
export function toFormData(p: ApiProduct): ProductData {
  return {
    id: p.id, name: p.name, slug: p.slug, sku: p.sku, brandId: p.brandId ?? "", categoryId: p.categoryId, shortDescription: p.shortDescription ?? "", description: p.description ?? "", badge: p.badge ?? "", isActive: p.isActive,
    retailPrice: String(p.retailPrice), retailDiscount: String(p.retailDiscount), wholesalePrice: p.wholesalePrice == null ? "" : String(p.wholesalePrice), wholesaleDiscount: String(p.wholesaleDiscount), minWholesaleQty: String(p.minWholesaleQty),
    seoTitle: p.seoTitle ?? "", seoDescription: p.seoDescription ?? "", canonical: p.canonical ?? "", phoneModelIds: p.phoneModelIds,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt ?? "" })),
    variants: p.variants.map((v) => ({ id: v.id, sku: v.sku, name: v.name, color: v.color ?? "", colorHex: v.colorHex ?? "", retailPrice: v.retailPrice == null ? "" : String(v.retailPrice), wholesalePrice: v.wholesalePrice == null ? "" : String(v.wholesalePrice), isActive: v.isActive, stock: "0", current: v.inventory?.quantity ?? 0 })),
    history: p.priceHistory.map((h) => ({ id: h.id, type: h.type, oldPrice: h.oldPrice, newPrice: h.newPrice, createdAt: new Date(h.createdAt).toISOString() })),
  };
}

export const emptyProduct = (categoryId: string): ProductData => ({ name: "", slug: "", sku: "", brandId: "", categoryId, shortDescription: "", description: "", badge: "", isActive: true, retailPrice: "", retailDiscount: "0", wholesalePrice: "", wholesaleDiscount: "0", minWholesaleQty: "1", seoTitle: "", seoDescription: "", canonical: "", phoneModelIds: [], images: [], variants: [{ sku: "", name: "پیش‌فرض", color: "", colorHex: "", retailPrice: "", wholesalePrice: "", isActive: true, stock: "0" }] });
