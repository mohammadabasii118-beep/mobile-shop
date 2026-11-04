"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCartCount } from "@/store/cart";
import { cn, toFa } from "@/lib/utils";

export function CartButton({ className }: { className?: string }) {
  const count = useCartCount();
  return (
    <Link
      href="/cart"
      className={cn("relative flex h-12 items-center gap-2 rounded-2xl bg-neutral-950 px-3.5 text-white transition hover:bg-primary sm:px-4", className)}
      aria-label={`سبد خرید، ${count} کالا`}
    >
      <ShoppingBag className="size-5" />
      <span className="hidden text-sm font-semibold lg:inline">سبد خرید</span>
      <span
        key={count}
        className={cn(
          "absolute -top-1.5 -left-1.5 grid min-w-6 place-items-center rounded-full border-2 border-white bg-primary px-1 text-[11px] leading-5 font-bold text-white",
          count > 0 ? "animate-in zoom-in-50" : "opacity-0",
        )}
      >
        {toFa(count)}
      </span>
    </Link>
  );
}
