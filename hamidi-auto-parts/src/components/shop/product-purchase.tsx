"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { CartItem } from "@/lib/cart-item";
import { AddToCartButton } from "./add-to-cart-button";
import { formatPrice, toFa } from "@/lib/utils";

export function QtyStepper({ value, onChange, max, size = "md", label }: { value: number; onChange: (n: number) => void; max: number; size?: "sm" | "md"; label: string }) {
  const h = size === "sm" ? "h-9" : "h-12";
  const w = size === "sm" ? "w-8" : "w-11";
  return (
    <div role="group" aria-label={`تعداد ${label}`} className={`flex ${h} items-center rounded-xl border border-neutral-300 bg-white`}>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className={`grid ${w} h-full cursor-pointer place-items-center rounded-r-xl text-neutral-800 transition hover:bg-neutral-100 disabled:opacity-30`} aria-label="افزایش تعداد"><Plus className="size-4" /></button>
      <output aria-live="polite" className="w-9 text-center text-sm font-bold tabular-nums">{toFa(value)}</output>
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} className={`grid ${w} h-full cursor-pointer place-items-center rounded-l-xl text-neutral-800 transition hover:bg-neutral-100 disabled:opacity-30`} aria-label="کاهش تعداد"><Minus className="size-4" /></button>
    </div>
  );
}

export function ProductPurchase({ item }: { item: CartItem }) {
  const [qty, setQty] = useState(1);
  if (!item.available) return <AddToCartButton item={item} size="lg" className="h-12 w-full" />;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-sm">
        <span className="text-neutral-600">جمع برای {toFa(qty)} عدد</span>
        <span className="font-extrabold">{formatPrice(item.price * qty)} <span className="text-xs font-normal text-neutral-600">تومان</span></span>
      </div>
      <div className="flex gap-2">
        <QtyStepper value={qty} onChange={setQty} max={item.maxQty} label={item.name} />
        <AddToCartButton item={item} qty={qty} size="lg" className="h-12 flex-1" />
      </div>
    </div>
  );
}
