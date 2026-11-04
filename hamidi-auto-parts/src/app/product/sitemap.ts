import type { MetadataRoute } from "next";
import { allProducts, productPath } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/seo";

/** Product sitemaps: /product/sitemap/0.xml, /product/sitemap/1.xml … (Google allows 50k URLs per file). */
export const PRODUCTS_PER_SITEMAP = 10_000;

export function productSitemapCount() {
  return Math.max(1, Math.ceil(allProducts().length / PRODUCTS_PER_SITEMAP));
}

export async function generateSitemaps() {
  return Array.from({ length: productSitemapCount() }, (_, id) => ({ id }));
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  return allProducts()
    .slice(id * PRODUCTS_PER_SITEMAP, (id + 1) * PRODUCTS_PER_SITEMAP)
    .map((p) => ({
      url: absoluteUrl(productPath(p)),
      lastModified: new Date(p.addedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
      images: [absoluteUrl(p.image)],
    }));
}
