import type { MetadataRoute } from 'next';
import { all } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const products = all<{ slug: string; updated_at: string }>("SELECT slug, updated_at FROM products WHERE status = 'published'");
  const cats = all<{ slug: string }>('SELECT slug FROM categories WHERE active = 1');
  return [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/shop`, changeFrequency: 'daily', priority: 0.9 },
    ...cats.map((c) => ({ url: `${base}/category/${encodeURIComponent(c.slug)}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${base}/product/${encodeURIComponent(p.slug)}`, lastModified: new Date(p.updated_at.replace(' ', 'T') + 'Z'), changeFrequency: 'weekly' as const, priority: 0.7 })),
  ];
}
