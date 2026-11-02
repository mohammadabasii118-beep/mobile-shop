import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { products, categories } from "@/lib/products";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages = [
    "",
    "/products",
    "/about",
    "/contact",
    "/terms",
    "/track",
    "/login",
    "/wishlist",
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  const categoryPages = categories.map((c) => ({
    url: `${SITE_URL}/products?cat=${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const productPages = products.map((p) => ({
    url: `${SITE_URL}/products/${p.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...categoryPages, ...productPages];
}
