import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { abs, paths, siteUrl } from "@/lib/seo";

// Built from the database on every request (edits/publishing show up immediately). Put a CDN in front for caching.
export const dynamic = "force-dynamic";

/**
 * Only real, indexable pages: active products, categories/brands/phone models that actually contain products,
 * and published articles. Private areas and empty listing pages are never listed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [products, categories, brands, models, posts, seo] = await Promise.all([
    db.product.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true, images: { take: 1, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], select: { url: true } } } }),
    db.category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true, _count: { select: { products: { where: { isActive: true } } } }, children: { where: { isActive: true }, select: { _count: { select: { products: { where: { isActive: true } } } } } } } }),
    db.brand.findMany({ where: { isActive: true, products: { some: { isActive: true } } }, select: { slug: true } }),
    db.phoneModel.findMany({ where: { isActive: true, products: { some: { product: { isActive: true } } } }, select: { slug: true } }),
    db.blogPost.findMany({ where: { isPublished: true, publishedAt: { lte: now } }, select: { slug: true, updatedAt: true, publishedAt: true } }),
    db.sEOSetting.findMany({ select: { scope: true, robots: true } }),
  ]);
  const noindex = new Set(seo.filter((s) => s.robots?.includes("noindex")).map((s) => s.scope));
  const entries: MetadataRoute.Sitemap = [];
  const add = (path: string, lastModified: Date | undefined, changeFrequency: "daily" | "weekly" | "monthly", priority: number, images?: string[]) =>
    entries.push({ url: abs(path)!, lastModified, changeFrequency, priority, ...(images?.length ? { images } : {}) });
  if (!noindex.has("home")) add("/", now, "daily", 1);
  if (!noindex.has("shop")) add("/shop", now, "daily", 0.9);
  if (!noindex.has("blog")) add("/blog", now, "weekly", 0.6);
  add("/support", undefined, "monthly", 0.3);
  for (const c of categories) if (c._count.products + c.children.reduce((a, x) => a + x._count.products, 0) > 0) add(paths.category(c.slug), c.updatedAt, "weekly", 0.8);
  for (const b of brands) add(paths.brand(b.slug), undefined, "weekly", 0.6);
  for (const m of models) add(paths.model(m.slug), undefined, "weekly", 0.6);
  for (const p of products) add(paths.product(p.slug), p.updatedAt, "weekly", 0.7, p.images[0] ? [abs(p.images[0].url)!] : undefined);
  for (const a of posts) add(paths.post(a.slug), a.updatedAt, "monthly", 0.5);
  void siteUrl;
  return entries;
}
