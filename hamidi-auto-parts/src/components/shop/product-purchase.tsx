"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { Product } from "@/data/products";
import { AddToCartButton } from "./add-to-cart-button";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { MAX_QTY } from "@/store/cart";
import { formatPrice, toFa, whatsappLink } from "@/lib/utils";

export function QtyStepper({ value, onChange, max = MAX_QTY, size = "md" }: { value: number; onChange: (n: number) => void; max?: number; size?: "sm" | "md" }) {
  const h = size === "sm" ? "h-9" : "h-12";
  const w = size === "sm" ? "w-8" : "w-11";
  return (
    <div className={`flex ${h} items-center rounded-xl border border-neutral-200 bg-white`}>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className={`grid ${w} h-full cursor-pointer place-items-center rounded-r-xl text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-30`} aria-label="افزایش تعداد"><Plus className="size-4" /></button>
      <span className="w-9 text-center text-sm font-bold tabular-nums">{toFa(value)}</span>
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} className={`grid ${w} h-full cursor-pointer place-items-center rounded-l-xl text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-30`} aria-label="کاهش تعداد"><Minus className="size-4" /></button>
    </div>
  );
}

export function ProductPurchase({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);
  const out = product.stock === "out-of-stock";
  return (
    <div className="space-y-3">
      {!out && (
        <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-sm">
          <span className="text-neutral-500">جمع برای {toFa(qty)} عدد</span>
          <span className="font-extrabold">{formatPrice(product.price * qty)} <span className="text-xs font-normal text-neutral-500">تومان</span></span>
        </div>
      )}
      <div className="flex gap-2">
        {!out && <QtyStepper value={qty} onChange={setQty} max={Math.min(MAX_QTY, product.stockQty)} />}
        <AddToCartButton product={product} qty={qty} size="lg" className="h-12 flex-1" />
      </div>
      <Button variant="whatsapp" size="lg" className="h-12 w-full" asChild>
        <a href={whatsappLink(`سلام، درباره قطعه «${product.name}» با کد ${product.sku} سؤال دارم.`)} target="_blank" rel="noreferrer">
          <WhatsAppIcon className="size-5" />
          استعلام و مشاوره در واتساپ
        </a>
      </Button>
    </div>
  );
}
