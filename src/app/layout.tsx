import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SITE_URL } from "@/lib/site";
import { CartProvider } from "@/lib/cart-context";
import { WishlistProvider } from "@/lib/wishlist-context";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const vazir = localFont({
  src: "./fonts/Vazirmatn.ttf",
  variable: "--font-vazir",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "لوکس‌سل | فروشگاه لوکس لوازم جانبی موبایل",
    template: "%s | لوکس‌سل",
  },
  description:
    "لوکس‌سل، مرجع تخصصی لوازم جانبی موبایل با طراحی مدرن و تجربه‌ای آینده‌نگر؛ قاب، گلس، شارژر، پاوربانک، هندزفری، اسپیکر و ساعت هوشمند.",
  keywords: ["لوازم جانبی موبایل", "قاب موبایل", "پاوربانک", "شارژر", "ساعت هوشمند", "لوکس‌سل"],
  openGraph: {
    title: "لوکس‌سل | فروشگاه لوکس لوازم جانبی موبایل",
    description: "تجربه‌ای آینده‌نگر از خرید لوازم جانبی موبایل",
    type: "website",
    locale: "fa_IR",
  },
};

export const viewport: Viewport = {
  themeColor: "#050506",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" className={vazir.variable}>
      <body className="min-h-screen bg-ink-950 font-sans antialiased">
        <CartProvider>
          <WishlistProvider>
            <div className="relative flex min-h-screen flex-col">
              <a href="#main" className="skip-link">
                پرش به محتوای اصلی
              </a>
              <Header />
              <main id="main" className="flex-1">
                {children}
              </main>
              <Footer />
            </div>
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
