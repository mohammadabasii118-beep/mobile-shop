"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, User, ShoppingBag, Menu, Heart } from "lucide-react";
import { categories } from "@/lib/products";
import { useCart } from "@/lib/cart-context";
import { useWishlist } from "@/lib/wishlist-context";
import { toFa } from "@/lib/format";
import MobileMenu from "./MobileMenu";
import CartDrawer from "./CartDrawer";
import Logo from "./Logo";

export default function Header() {
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-all duration-500 ${
          scrolled
            ? "glass border-b border-white/[0.06] shadow-luxe"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          {/* mobile menu button */}
          <button
            onClick={() => setMenuOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-lg text-silver-200 hover:bg-white/5 lg:hidden"
            aria-label="باز کردن منو"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="text-lg font-extrabold tracking-tight text-metal">
              لوکس‌سل
            </span>
          </Link>

          {/* desktop nav */}
          <nav className="mr-6 hidden items-center gap-1 lg:flex">
            <div
              className="relative"
              onMouseEnter={() => setCatOpen(true)}
              onMouseLeave={() => setCatOpen(false)}
            >
              <button className="rounded-lg px-3 py-2 text-sm text-silver-200 transition hover:bg-white/5 hover:text-white">
                دسته‌بندی‌ها
              </button>
              {catOpen && (
                <div className="absolute right-0 top-full w-[560px] animate-fade-up pt-2">
                  <div className="glass grid grid-cols-2 gap-1 rounded-2xl p-3 shadow-luxe">
                    {categories.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/products?cat=${c.slug}`}
                        className="flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:bg-white/5"
                      >
                        <span className="text-sm text-silver-100">{c.name}</span>
                        <span className="text-[11px] text-silver-500">
                          {c.tagline}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Link
              href="/products"
              className="rounded-lg px-3 py-2 text-sm text-silver-200 transition hover:bg-white/5 hover:text-white"
            >
              فروشگاه
            </Link>
            <Link
              href="/products?sort=newest"
              className="rounded-lg px-3 py-2 text-sm text-silver-200 transition hover:bg-white/5 hover:text-white"
            >
              جدیدترین
            </Link>
            <Link
              href="/products?sort=bestseller"
              className="rounded-lg px-3 py-2 text-sm text-silver-200 transition hover:bg-white/5 hover:text-white"
            >
              پرفروش‌ترین
            </Link>
            <Link
              href="/about"
              className="rounded-lg px-3 py-2 text-sm text-silver-200 transition hover:bg-white/5 hover:text-white"
            >
              درباره ما
            </Link>
            <Link
              href="/contact"
              className="rounded-lg px-3 py-2 text-sm text-silver-200 transition hover:bg-white/5 hover:text-white"
            >
              تماس
            </Link>
          </nav>

          <div className="flex flex-1 items-center justify-end gap-1.5">
            {/* search */}
            <Link
              href="/products"
              className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-silver-400 transition hover:border-white/20 md:flex"
            >
              <Search className="h-4 w-4" />
              <span>جستجوی محصولات…</span>
            </Link>
            <Link
              href="/products"
              className="grid h-10 w-10 place-items-center rounded-lg text-silver-200 hover:bg-white/5 md:hidden"
              aria-label="جستجو"
            >
              <Search className="h-5 w-5" />
            </Link>

            <Link
              href="/wishlist"
              className="relative hidden h-10 w-10 place-items-center rounded-lg text-silver-200 hover:bg-white/5 sm:grid"
              aria-label="علاقه‌مندی‌ها"
            >
              <Heart className="h-5 w-5" />
              {wishCount > 0 && (
                <span className="num absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">
                  {toFa(wishCount)}
                </span>
              )}
            </Link>
            <Link
              href="/account"
              className="grid h-10 w-10 place-items-center rounded-lg text-silver-200 hover:bg-white/5"
              aria-label="حساب کاربری"
            >
              <User className="h-5 w-5" />
            </Link>

            {/* cart */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative grid h-10 w-10 place-items-center rounded-lg text-silver-100 hover:bg-white/5"
              aria-label="سبد خرید"
            >
              <ShoppingBag className="h-5 w-5" />
              {count > 0 && (
                <span className="num absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-ink-900">
                  {toFa(count)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
