import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { FloatingContact } from "@/components/layout/floating-contact";
import { Toaster } from "@/components/ui/toaster";
import { JsonLd, organizationLd, websiteLd } from "@/lib/seo";
import { SHOP, SITE_URL } from "@/lib/utils";

/**
 * Vazirmatn variable font, self-hosted and subset to Persian + Basic Latin
 * (73 KB for every weight). next/font preloads it and generates a
 * size-adjusted fallback so the swap causes no layout shift.
 */
const vazir = localFont({
  src: "../fonts/vazirmatn-fa.woff2",
  variable: "--font-vazir",
  weight: "100 900",
  display: "swap",
  preload: true,
  adjustFontFallback: "Arial",
  fallback: ["Tahoma", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SHOP.nameFa} | لوازم یدکی نیسان و هوندا — HAMIDI AUTO PARTS`,
    template: `%s | ${SHOP.nameFa}`,
  },
  description:
    "فروشگاه حمیدی، مرجع تخصصی لوازم یدکی نیسان و هوندا؛ قطعات اصلی و OEM با ضمانت اصالت و ارسال سریع به سراسر ایران.",
  applicationName: SHOP.nameFa,
  authors: [{ name: SHOP.nameFa, url: SITE_URL }],
  creator: SHOP.nameFa,
  publisher: SHOP.nameFa,
  category: "automotive",
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: { type: "website", locale: "fa_IR", siteName: SHOP.nameFa, url: "/" },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0d",
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa-IR" dir="rtl" className={vazir.variable}>
      <body className="flex min-h-dvh flex-col font-sans">
        <a href="#main" className="sr-only z-[70] rounded-xl bg-neutral-950 px-4 py-3 text-white focus:not-sr-only focus:fixed focus:top-3 focus:right-3">
          پرش به محتوای اصلی
        </a>
        <JsonLd data={[organizationLd(), websiteLd()]} />
        <Header />
        <main id="main" className="flex-1" tabIndex={-1}>
          {children}
        </main>
        <Footer />
        <FloatingContact />
        <Toaster />
      </body>
    </html>
  );
}
