import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { APP_NAME } from "@/config/app";
import { LOCALE_COOKIE, isRtl, toLocale } from "@/i18n/config";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Social media management & automation panel for Telegram and Instagram (demo).",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap" />
      </head>
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
