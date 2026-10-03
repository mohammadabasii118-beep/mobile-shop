"use client";

import { Grid2x2, Home, ShoppingBag, Sparkles, User } from "lucide-react";
import { useCart } from "@/features/cart/cart-context";
import { formatNumber } from "@/lib/format";

/** Bottom navigation موبایل؛ ترتیب RTL (اولین آیتم سمت راست) */
export function BottomNav() {
  const { setOpen, totals } = useCart();
  const item = "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted transition-colors active:text-fg";
  return (
    <nav aria-label="ناوبری پایین" className="surface-dark fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] text-fg backdrop-blur-md md:hidden">
      <a href="#top" className={item}><Home className="size-5" aria-hidden />خانه</a>
      <a href="#categories" className={item}><Grid2x2 className="size-5" aria-hidden />دسته‌ها</a>
      <a href="#showcase" className={item}><Sparkles className="size-5" aria-hidden />۳D</a>
      <button onClick={() => setOpen(true)} className={item}>
        <span className="relative">
          <ShoppingBag className="size-5" aria-hidden />
          {totals.count > 0 && (
            <span className="num absolute -end-2.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-accent-fg">{formatNumber(totals.count)}</span>
          )}
        </span>
        سبد
      </button>
      <a href="/admin" className={item}><User className="size-5" aria-hidden />حساب</a>
    </nav>
  );
}
