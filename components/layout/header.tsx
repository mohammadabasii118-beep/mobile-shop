"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { Logo } from "./logo";
import { SearchBox } from "./search-box";
import { useCart } from "@/features/cart/cart-context";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { useDialog } from "@/hooks/use-dialog";

const NAV = [
  { href: "#categories", label: "دسته‌بندی‌ها" },
  { href: "#showcase", label: "نمایش ۳D" },
  { href: "#best-sellers", label: "پرفروش‌ها" },
  { href: "#product-preview", label: "محصول ویژه" },
  { href: "/admin", label: "پنل مدیریت" },
];

function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useDialog(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className="surface-dark absolute inset-x-0 top-0 max-h-[100dvh] overflow-auto rounded-b-xl bg-elevated p-4 text-fg shadow-float"
            initial={{ y: "-8%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-8%", opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="t-h3">{title}</span>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="بستن"><X /></Button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Header() {
  const { totals, setOpen, bump } = useCart();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-fg">
        پرش به محتوا
      </a>
      <header className="surface-dark sticky top-0 z-40 border-b border-line bg-bg/95 text-fg backdrop-blur-md">
        <div className="container-x flex h-16 items-center gap-3 md:h-[72px] md:gap-6">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMenu(true)} aria-label="باز کردن منو">
            <Menu />
          </Button>
          <Logo />

          <nav aria-label="ناوبری اصلی" className="hidden items-center gap-1 lg:flex">
            {NAV.slice(0, 4).map((n) => (
              <a key={n.href} href={n.href} className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium text-muted transition-colors hover:text-fg">
                {n.label}
              </a>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-1 md:gap-2">
            <SearchBox className="hidden w-72 md:block xl:w-80" />
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSearch(true)} aria-label="جستجو">
              <Search />
            </Button>
            <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="علاقه‌مندی‌ها"><Heart /></Button>
            <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="حساب کاربری"><User /></Button>
            <Button variant="secondary" size="icon" onClick={() => setOpen(true)} aria-label={`سبد خرید، ${formatNumber(totals.count)} کالا`} className="relative">
              <ShoppingBag />
              <AnimatePresence>
                {totals.count > 0 && (
                  <motion.span
                    key={bump}
                    initial={{ scale: 0.6 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                    className="num absolute -end-1 -top-1 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold leading-5 text-accent-fg"
                  >
                    {formatNumber(totals.count)}
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </div>
        </div>
      </header>

      <Sheet open={menu} onClose={() => setMenu(false)} title="منو">
        <nav aria-label="منوی موبایل" className="flex flex-col">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setMenu(false)} className="flex min-h-12 items-center border-b border-line text-lg font-semibold">
              {n.label}
            </a>
          ))}
        </nav>
      </Sheet>
      <Sheet open={search} onClose={() => setSearch(false)} title="جستجو">
        <SearchBox autoFocus onDone={() => setSearch(false)} className="[&>div:last-child]:static [&>div:last-child]:mt-3 [&>div:last-child]:w-full [&>div:last-child]:shadow-none" />
      </Sheet>
    </>
  );
}
