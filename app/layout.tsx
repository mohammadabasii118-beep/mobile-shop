import type { Metadata, Viewport } from "next";
import "./globals.css";
import { themeScript } from "@/components/theme";

export const metadata: Metadata = {
  title: "CaseLine | فروشگاه لوازم جانبی موبایل",
  description: "قاب، گلس، شارژر، کابل و هندزفری با تضمین سازگاری با مدل گوشی شما",
};
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f6f5f2" }, { media: "(prefers-color-scheme: dark)", color: "#0e1016" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
