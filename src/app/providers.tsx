"use client";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { I18nProvider } from "@/i18n/provider";
import type { Locale } from "@/i18n/config";

export function Providers({ children, locale }: { children: ReactNode; locale: Locale }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: false } } }));
  return (
    <ThemeProvider attribute="class" defaultTheme="light" storageKey="sm-theme" enableSystem={false}>
      <I18nProvider initialLocale={locale}>
        <QueryClientProvider client={client}>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
