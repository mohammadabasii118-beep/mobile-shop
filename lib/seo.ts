import "server-only";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSiteInfo } from "@/lib/queries";

/** Public origin used for canonical URLs, sitemap and structured data (from APP_URL). */
export const siteUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
/** Absolute URL for a site path or an already-absolute URL. Persian slugs are percent-encoded consistently. */
export function abs(pathOrUrl: string | null | undefined): string | undefined {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return siteUrl() + encodeURI(pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`);
}
/** Path of a public entity page (single source of truth for links, canonicals and the sitemap). */
export const paths = {
  product: (slug: string) => `/product/${slug}`,
  category: (slug: string) => `/category/${slug}`,
  brand: (slug: string) => `/brand/${slug}`,
  model: (slug: string) => `/model/${slug}`,
  post: (slug: string) => `/blog/${slug}`,
};

export function clip(text: string | null | undefined, max = 160): string | undefined {
  if (!text) return undefined;
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  return t.length <= max ? t : t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

/** Serialises structured data safely for a <script type="application/ld+json"> (no HTML can break out). */
export const ldJson = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/** Schema.org prices are sent in IRR (rial); the shop stores Toman. */
export const toRial = (toman: number) => toman * 10;

export interface SeoSetting { title: string | null; description: string | null; ogImage: string | null; robots: string | null }
/** Page-level SEO defaults edited in the admin panel (SEOSetting scopes: global, home, shop, blog, support …). */
export async function getSeoSetting(scope: string): Promise<SeoSetting> {
  const [row, global] = await Promise.all([db.sEOSetting.findUnique({ where: { scope } }), scope === "global" ? null : db.sEOSetting.findUnique({ where: { scope: "global" } })]);
  // Titles/descriptions are per page (falling back to global would give every page the same title); only the
  // home page inherits the global text, and the social image is shared.
  const inherit = scope === "home";
  // The home TITLE is never inherited from the global row: it follows the site name + tagline (هویت سایت) unless /admin/seo sets one for the home page.
  return { title: row?.title ?? null, description: row?.description ?? (inherit ? global?.description : null) ?? null, ogImage: row?.ogImage ?? global?.ogImage ?? null, robots: row?.robots ?? null };
}

export interface MetaInput {
  title: string; description?: string | null; path: string; image?: string | null; type?: "website" | "article"; canonical?: string | null;
  robots?: string | null; noindex?: boolean; publishedTime?: Date | null; modifiedTime?: Date | null;
}
/** One place that builds title/description/canonical/Open Graph/Twitter so no page can forget a piece. */
export async function buildMeta(m: MetaInput): Promise<Metadata> {
  const info = await getSiteInfo();
  const canonical = abs(m.canonical || m.path);
  const description = clip(m.description) ?? undefined;
  const image = abs(m.image);
  const robots = m.noindex ? { index: false, follow: true } : m.robots ? { index: !m.robots.includes("noindex"), follow: !m.robots.includes("nofollow") } : undefined;
  return {
    title: m.title,
    description,
    alternates: { canonical },
    robots,
    openGraph: {
      type: m.type ?? "website", url: canonical, title: m.title, description, siteName: info.name, locale: "fa_IR",
      ...(image ? { images: [{ url: image }] } : {}),
      ...(m.type === "article" ? { publishedTime: m.publishedTime?.toISOString(), modifiedTime: m.modifiedTime?.toISOString() } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title: m.title, description, ...(image ? { images: [image] } : {}) },
  };
}

export const breadcrumbLd = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
});
