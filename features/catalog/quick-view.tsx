"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ShoppingBag, X } from "lucide-react";
import type { Product } from "@/types/product";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { Rating } from "@/components/ui/rating";
import { ProductArt } from "@/components/product/product-art";
import { Swatches } from "./swatches";
import { useDialog } from "@/hooks/use-dialog";
import { useCart } from "@/features/cart/cart-context";
import { buildLine } from "@/features/cart/build-line";

export function QuickView({ product, open, onClose, initialColor }: { product: Product; open: boolean; onClose: () => void; initialColor: string }) {
  const [colorId, setColorId] = useState(initialColor);
  const { add } = useCart();
  const ref = useDialog(open, onClose);
  const color = product.colors.find((c) => c.id === colorId) ?? product.colors[0];
  const out = product.stock === 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] grid place-items-end md:place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={`نمای سریع ${product.name}`}
            tabIndex={-1}
            className="relative grid max-h-[92dvh] w-full overflow-auto rounded-t-xl bg-elevated text-fg shadow-float outline-none md:max-w-3xl md:grid-cols-2 md:rounded-xl"
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            <Button variant="secondary" size="icon" onClick={onClose} aria-label="بستن" className="absolute end-3 top-3 z-10"><X /></Button>
            <div className="grid aspect-square place-items-center bg-stage p-8 md:rounded-s-xl">
              <ProductArt kind={product.kind} color={color.hex} className="size-full max-w-72" label={`${product.name}، رنگ ${color.name}`} />
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div>
                <p className="t-caption text-muted"><bdi>{product.brand}</bdi></p>
                <h2 className="t-h2 mt-1">{product.name}</h2>
                <Rating value={product.rating} count={product.reviewCount} className="mt-2" />
              </div>
              <Price value={product.price} oldValue={product.oldPrice} size="lg" />
              <p className="t-small text-muted">{product.blurb}</p>
              <div>
                <p className="t-caption mb-2">رنگ: <b>{color.name}</b></p>
                <Swatches colors={product.colors} value={colorId} onChange={setColorId} size="md" />
              </div>
              <p className="t-caption text-muted">سازگار با: <bdi>{product.compatibility.join("، ")}</bdi></p>
              <Button
                size="lg"
                className="mt-auto w-full"
                disabled={out}
                onClick={() => { add(buildLine(product, color)); onClose(); }}
              >
                {out ? <>ناموجود</> : <><ShoppingBag /> افزودن به سبد</>}
              </Button>
              <p className="t-caption flex items-center gap-1 text-success"><Check className="size-4" aria-hidden /> ارسال از انبار تهران</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
