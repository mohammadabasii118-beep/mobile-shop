import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { FloatingContact } from "@/components/layout/floating-contact";

const vazir = localFont({
  src: "./Vazirmatn.woff2",
  variable: "--font-vazir",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "فروشگاه حمیدی | HAMIDI AUTO PARTS — لوازم یدکی نیسان و هوندا", template: "%s | فروشگاه حمیدی" },
  description: "مرجع تخصصی لوازم یدکی نیسان و هوندا. قطعات اصلی و OEM مورانو، ماکسیما، تیانا، ایکس‌تریل، جوک، اکسل و تمام مدل‌های هوندا ۱۹۹۰ تا ۲۰۱۷.",
};

export const viewport: Viewport = { themeColor: "#0b0b0d" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa" dir="rtl" className={vazir.variable}>
      <body className="flex min-h-dvh flex-col font-sans">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <FloatingContact />
        <Toaster position="top-center" dir="rtl" richColors closeButton toastOptions={{ style: { fontFamily: "var(--font-vazir)" } }} />
      </body>
    </html>
  );
}
