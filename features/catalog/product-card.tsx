"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Eye, Heart, Plus } from "lucide-react";
import type { Product } from "@/types/product";
import { Badge } from "@/components/ui/badge";
import { Price } from "@/components/ui/price";
import { Rating } from "@/components/ui/rating";
import { ProductArt } from "@/components/product/product-art";
import { Swatches } from "./swatches";
import { QuickView } from "./quick-view";
import { useCart } from "@/features/cart/cart-context";
import { buildLine } from "@/features/cart/build-line";
import { discountPercent } from "@/lib/pricing";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Product Card — DESIGN.md §8.
 * تصویر روی stage بدون padding، متن زیر آن. Hover: تصویر دوم + نوار Quick Add.
 */
export function ProductCard({ product }: { product: Product }) {
  const [colorId, setColorId] = useState(product.colors[0].id);
  const [wish, setWish] = useState(false);
  const [added, setAdded] = useState(false);
  const [quick, setQuick] = useState(false);
  const { add } = useCart();
  const color = product.colors.find((c) => c.id === colorId)!;
  const pct = discountPercent(product.price, product.oldPrice);
  const out = product.stock === 0;
  const low = product.stock > 0 && product.stock <= 8;

  const quickAdd = () => {
    add(buildLine(product, color), 1, false);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };

  return (
    <article className="group/card flex flex-col">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-stage transition-shadow duration-300 group-hover/card:shadow-card">
        {/* تصویر اصلی ↔ دوم */}
        <a href="#product-preview" aria-label={product.name} className="absolute inset-0 grid place-items-center p-6">
          <ProductArt kind={product.kind} color={color.hex} className={cn("size-full transition-all duration-500 ease-out group-hover/card:scale-105 group-hover/card:opacity-0", out && "opacity-50 grayscale")} label={`${product.name}، رنگ ${color.name}`} />
          <ProductArt kind={product.kind} color={color.hex} view="alt" className="pointer-events-none absolute inset-6 size-[calc(100%-3rem)] scale-95 opacity-0 transition-all duration-500 ease-out group-hover/card:scale-100 group-hover/card:opacity-100" label="" />
        </a>

        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between">
          <div className="flex max-w-[calc(100%-3rem)] flex-col items-start gap-1.5">
            {pct > 0 && <Badge variant="discount" className="num bg-surface">{formatNumber(pct)}٪ تخفیف</Badge>}
            {product.badge === "new" && <Badge variant="accent">جدید</Badge>}
            {product.badge === "bestseller" && pct === 0 && <Badge variant="neutral" className="bg-surface">پرفروش</Badge>}
          </div>
        </div>
        <button
          onClick={() => setWish((w) => !w)}
          aria-pressed={wish}
          aria-label={wish ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
          className="absolute end-1.5 top-1.5 grid size-11 place-items-center rounded-full text-fg"
        >
          <motion.span key={String(wish)} initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 14 }} className="grid size-9 place-items-center rounded-full bg-surface/90">
            <Heart className={cn("size-[18px]", wish && "fill-discount text-discount")} />
          </motion.span>
        </button>

        {out && <span className="absolute inset-x-0 bottom-0 bg-surface/90 py-2 text-center text-sm font-semibold">ناموجود</span>}

        {/* Quick actions: hover (دسکتاپ) / همیشه‌دیده (لمسی) */}
        {!out && (
          <div className="absolute inset-x-2 bottom-2 flex translate-y-0 items-center gap-2 transition-all duration-300 ease-out [@media(hover:hover)]:translate-y-3 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/card:translate-y-0 [@media(hover:hover)]:group-focus-within/card:opacity-100 [@media(hover:hover)]:group-hover/card:translate-y-0 [@media(hover:hover)]:group-hover/card:opacity-100">
            <button
              onClick={quickAdd}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary text-sm font-semibold text-primary-fg transition-transform active:scale-[0.97]"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={String(added)} className="flex items-center gap-1.5" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.18 }}>
                  {added ? <><Check className="size-4" aria-hidden /> اضافه شد</> : <><Plus className="size-4" aria-hidden /> افزودن سریع</>}
                </motion.span>
              </AnimatePresence>
            </button>
            <button onClick={() => setQuick(true)} aria-label={`نمای سریع ${product.name}`} className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-fg">
              <Eye className="size-[18px]" />
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-1 flex-col gap-1.5 px-1">
        <div className="flex items-center justify-between gap-2">
          <span className="t-caption text-muted"><bdi>{product.brand}</bdi></span>
          <Rating value={product.rating} count={product.reviewCount} className="text-xs" />
        </div>
        <h3 className="t-h3 line-clamp-2 !text-base !leading-7"><a href="#product-preview">{product.name}</a></h3>
        <p className="t-caption truncate text-muted">سازگار با <bdi>{product.compatibility[0]}</bdi></p>
        <Swatches colors={product.colors} value={colorId} onChange={setColorId} label={`رنگ ${product.name}`} />
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <Price value={product.price} oldValue={product.oldPrice} size="sm" showDiscount={false} className="flex-col items-start gap-0" />
          {low && <span className="t-caption num text-warning">فقط {formatNumber(product.stock)} عدد</span>}
        </div>
      </div>

      <QuickView key={colorId} product={product} open={quick} onClose={() => setQuick(false)} initialColor={colorId} />
    </article>
  );
}
