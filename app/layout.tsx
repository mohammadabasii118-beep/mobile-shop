import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import arabicFont from "@fontsource-variable/noto-sans-arabic/files/noto-sans-arabic-arabic-wght-normal.woff2";
import latinFont from "@fontsource-variable/noto-sans-arabic/files/noto-sans-arabic-latin-wght-normal.woff2";
import displayFont from "@fontsource-variable/markazi-text/files/markazi-text-arabic-wght-normal.woff2";
import "./globals.css";
import { JsonLd } from "@/components/json-ld";
import { themeScript } from "@/components/theme";
import { getSiteInfo } from "@/lib/queries";
import { abs, siteUrl } from "@/lib/seo";

const fontUrl = (f: { src: string } | string) => (typeof f === "string" ? f : f.src);

export async function generateMetadata(): Promise<Metadata> {
  const info = await getSiteInfo().catch(() => null);
  const name = info?.name || "CaseLine";
  const title = `${name} | ${info?.tagline || "فروشگاه لوازم جانبی موبایل"}`;
  const description = "قاب، گلس، شارژر، کابل و هندزفری با تضمین سازگاری با مدل گوشی شما";
  return {
    metadataBase: new URL(siteUrl()),
    title, description,
    applicationName: name,
    // Icon set in admin (هویت سایت); otherwise the built-in CaseLine icon, so browser tabs never show a blank globe.
    icons: info?.favicon ? { icon: info.favicon, shortcut: info.favicon, apple: info.favicon } : { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/favicon.ico", sizes: "any" }], shortcut: "/favicon.ico", apple: "/apple-touch-icon.png" },
    openGraph: { type: "website", siteName: name, locale: "fa_IR", title, description },
    twitter: { card: "summary", title, description },
    formatDetection: { telephone: false },
  };
}
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f4f3ee" }, { media: "(prefers-color-scheme: dark)", color: "#0d1512" }],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Fonts: preloaded so Persian text renders in Noto Sans Arabic / Markazi Text from the first paint (no late swap → no layout shift).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const info = await getSiteInfo().catch(() => null);
  const same = [info?.telegram, info?.instagram].filter((u): u is string => !!u && /^https?:\/\//.test(u));
  const org = info && {
    "@context": "https://schema.org", "@type": "Organization", name: info.name, url: siteUrl(),
    ...(info.logo ? { logo: abs(info.logo) } : {}), ...(info.email ? { email: info.email } : {}), ...(info.phone ? { telephone: info.phone } : {}),
    ...(info.address ? { address: { "@type": "PostalAddress", streetAddress: info.address, addressCountry: "IR" } } : {}),
    ...(same.length ? { sameAs: same } : {}),
  };
  const website = info && { "@context": "https://schema.org", "@type": "WebSite", name: info.name, url: siteUrl(), inLanguage: "fa-IR", potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${siteUrl()}/shop?q={search_term_string}` }, "query-input": "required name=search_term_string" } };
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <meta name="enamad" content="3332818" />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preload" href={fontUrl(arabicFont)} as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href={fontUrl(latinFont)} as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href={fontUrl(displayFont)} as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg">پرش به محتوای اصلی</a>
        {children}
        <JsonLd data={[org, website]} />
        <Script src="/site.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
