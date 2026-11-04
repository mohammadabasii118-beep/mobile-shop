import type { MetadataRoute } from "next";
import { BRANDS, MODELS } from "@/data/vehicles";
import { CATEGORIES } from "@/data/categories";
import { allProducts, categoryPath, modelPath } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/seo";

/**
 * /sitemap.xml — landing pages (home, brands, models, categories, static pages).
 * Products live in /product/sitemap/[id].xml, split in chunks so the catalogue can grow to any size.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const latest = allProducts().reduce((d, p) => (p.addedAt > d ? p.addedAt : d), "2026-01-01");
  const lastModified = new Date(latest);
  return [
    { url: absoluteUrl("/"), lastModified, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/shop"), lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/categories"), lastModified, changeFrequency: "weekly", priority: 0.7 },
    ...BRANDS.map((b) => ({ url: absoluteUrl(`/${b.id}`), lastModified, changeFrequency: "daily" as const, priority: 0.9 })),
    ...MODELS.map((m) => ({ url: absoluteUrl(modelPath(m.brand, m.id)), lastModified, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...CATEGORIES.map((c) => ({ url: absoluteUrl(categoryPath(c.id)), lastModified, changeFrequency: "weekly" as const, priority: 0.8 })),
    { url: absoluteUrl("/about"), changeFrequency: "yearly", priority: 0.4 },
    { url: absoluteUrl("/contact"), changeFrequency: "yearly", priority: 0.5 },
  ];
}
