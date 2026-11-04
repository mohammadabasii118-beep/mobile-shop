import type { Metadata } from "next";
import { SHOP, SITE_URL } from "./utils";

export const absoluteUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

const DEFAULT_OG = { url: "/opengraph-image.jpg", width: 1200, height: 630, alt: `${SHOP.nameFa} — ${SHOP.slogan}` };

/**
 * Single source of truth for per-page metadata: title, description, canonical,
 * Open Graph, Twitter card and robots directives.
 */
export function pageMetadata({
  title,
  description,
  path,
  index = true,
  image,
  type = "website",
}: {
  title: string;
  description: string;
  /** canonical path, always without filter/sort parameters */
  path: string;
  index?: boolean;
  image?: { url: string; alt: string };
  type?: "website" | "article";
}): Metadata {
  const images = image ? [{ url: image.url, width: 1200, height: 1200, alt: image.alt }] : [DEFAULT_OG];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type, url: path, title, description, siteName: SHOP.nameFa, locale: "fa_IR", images },
    twitter: { card: "summary_large_image", title, description, images: images.map((i) => i.url) },
    robots: index ? { index: true, follow: true } : { index: false, follow: true, googleBot: { index: false, follow: true } },
  };
}

/** Escape JSON so it can never break out of the <script> tag. */
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export const ORG_ID = `${SITE_URL}/#organization`;

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "AutoPartsStore"],
    "@id": ORG_ID,
    name: SHOP.nameFa,
    alternateName: SHOP.nameEn,
    slogan: SHOP.slogan,
    url: SITE_URL,
    logo: absoluteUrl("/icon-512.png"),
    image: absoluteUrl("/opengraph-image.jpg"),
    email: SHOP.email,
    telephone: "+98-21-66712345",
    priceRange: "$$",
    currenciesAccepted: "IRR",
    address: {
      "@type": "PostalAddress",
      streetAddress: SHOP.street,
      addressLocality: SHOP.city,
      addressRegion: "تهران",
      postalCode: SHOP.postalCode,
      addressCountry: "IR",
    },
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"], opens: "09:00", closes: "19:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Thursday", opens: "09:00", closes: "14:00" },
    ],
    contactPoint: [
      { "@type": "ContactPoint", telephone: "+98-21-66712345", contactType: "sales", areaServed: "IR", availableLanguage: ["fa", "en"] },
      { "@type": "ContactPoint", telephone: "+98-912-1234567", contactType: "customer support", areaServed: "IR", availableLanguage: "fa" },
    ],
    sameAs: [`https://instagram.com/${SHOP.instagram}`, `https://t.me/${SHOP.telegram}`],
    knowsAbout: ["Nissan spare parts", "Honda spare parts", "OEM auto parts"],
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SHOP.nameFa,
    alternateName: SHOP.nameEn,
    inLanguage: "fa-IR",
    publisher: { "@id": ORG_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export type Crumb = { label: string; href?: string };

export function breadcrumbLd(items: Crumb[]) {
  const all: Crumb[] = [{ label: "خانه", href: "/" }, ...items];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: absoluteUrl(c.href) } : {}),
    })),
  };
}

export function itemListLd(name: string, urls: string[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: urls.length,
    itemListElement: urls.map((u, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(u) })),
  };
}

/**
 * Metadata for paginated / filterable listing pages.
 * - clean URL and ?page=N are indexable, each canonical to itself
 * - any filter or sort combination is noindex,follow and canonical to the clean URL
 */
export function listingMetadata(opts: { title: string; description: string; path: string; page: number; filtered: boolean }): Metadata {
  const paged = opts.page > 1 && !opts.filtered;
  return pageMetadata({
    title: paged ? `${opts.title} — صفحه ${opts.page.toLocaleString("fa-IR")}` : opts.title,
    description: opts.description,
    path: paged ? `${opts.path}?page=${opts.page}` : opts.path,
    index: !opts.filtered,
  });
}
