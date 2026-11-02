"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { categories } from "@/lib/products";
import Logo from "./Logo";

export default function MobileMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-[70] flex w-[82%] max-w-sm flex-col bg-ink-900 shadow-luxe lg:hidden"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] p-4">
              <Link href="/" onClick={onClose} className="flex items-center gap-2">
                <Logo className="h-7 w-7" />
                <span className="font-extrabold text-metal">لوکس‌سل</span>
              </Link>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-lg text-silver-200 hover:bg-white/5"
                aria-label="بستن"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4">
              <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-silver-500">
                دسته‌بندی‌ها
              </div>
              <div className="space-y-1">
                {categories.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/products?cat=${c.slug}`}
                    onClick={onClose}
                    className="flex items-center justify-between rounded-xl px-3 py-3 text-silver-100 transition hover:bg-white/5"
                  >
                    <span className="text-sm">{c.name}</span>
                    <span className="text-[11px] text-silver-500">{c.tagline}</span>
                  </Link>
                ))}
              </div>

              <div className="my-4 h-px bg-white/[0.06]" />
              <div className="space-y-1">
                {[
                  { href: "/products", label: "فروشگاه" },
                  { href: "/products?sort=newest", label: "جدیدترین محصولات" },
                  { href: "/products?sort=bestseller", label: "پرفروش‌ترین‌ها" },
                  { href: "/about", label: "درباره ما" },
                  { href: "/contact", label: "تماس با ما" },
                  { href: "/account", label: "حساب کاربری" },
                  { href: "/wishlist", label: "علاقه‌مندی‌ها" },
                  { href: "/cart", label: "سبد خرید" },
                ].map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={onClose}
                    className="block rounded-xl px-3 py-3 text-sm text-silver-100 transition hover:bg-white/5"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
