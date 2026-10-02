import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import { CartProvider } from "@/components/CartContext";
import { CompareProvider } from "@/components/CompareContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ThemeScript from "@/components/ThemeScript";
import { getSiteSettings } from "@/lib/siteSettings";

const vazir = Vazirmatn({ subsets: ["arabic"], variable: "--font-vazir", weight: ["400", "500", "600", "700", "800"] });

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "کیس لاین";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Real, admin-editable SEO metadata (Phase 6, /admin/settings) — falls back
// to the same hardcoded defaults as before whenever an admin hasn't filled
// a field in yet, so the site never regresses to blank/empty metadata.
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  const title = site.siteTitle || `${siteName} | فروشگاه قاب و اکسسوری موبایل`;
  const description = site.siteDescription || "قاب، کاور و اکسسوری اصل موبایل با ارسال سریع و ضمانت اصالت کالا.";
  return {
    metadataBase: new URL(siteUrl),
    title: { default: title, template: `%s | ${siteName}` },
    description,
    keywords: site.metaKeywords || undefined,
    // eNamad (اینماد) domain-ownership verification; rendered server-side in <head>.
    other: { enamad: "3332818" },
    openGraph: { type: "website", locale: "fa_IR", siteName, title: siteName, description },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazir.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="font-vazir">
        <SessionProviderWrapper>
          <CartProvider>
            <CompareProvider>
              <Header />
              <main>{children}</main>
              <Footer />
            </CompareProvider>
          </CartProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
