import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { themeScript } from "@/components/theme";
import { getSiteInfo } from "@/lib/queries";

export async function generateMetadata(): Promise<Metadata> {
  const info = await getSiteInfo().catch(() => null);
  return {
    title: info?.name ? `${info.name} | ${info.tagline || "فروشگاه لوازم جانبی موبایل"}` : "CaseLine | فروشگاه لوازم جانبی موبایل",
    description: "قاب، گلس، شارژر، کابل و هندزفری با تضمین سازگاری با مدل گوشی شما",
    ...(info?.favicon ? { icons: { icon: info.favicon } } : {}),
  };
}
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f6f5f2" }, { media: "(prefers-color-scheme: dark)", color: "#0e1016" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}<Script src="/site.js" strategy="afterInteractive" /></body>
    </html>
  );
}
