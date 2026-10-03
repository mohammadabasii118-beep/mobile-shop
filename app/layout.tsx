import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "ولتا — لوازم جانبی پرمیوم موبایل",
  description: "قاب، شارژر، ایربادز و پاوربانک با تجربهٔ سه‌بعدی؛ قبل از خرید بچرخان، رنگ را عوض کن و ببین.",
};

export const viewport: Viewport = { themeColor: "#0a0b0d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
