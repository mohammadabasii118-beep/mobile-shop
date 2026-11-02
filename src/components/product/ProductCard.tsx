"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Star, Plus, Check } from "lucide-react";
import type { Product } from "@/lib/products";
import { formatPrice, formatDiscount, toFa } from "@/lib/format";
import { useCart } from "@/lib/cart-context";
import ProductMedia from "@/components/ui/ProductMedia";

const BADGE_LABEL: Record<string, string> = {
  featured: "ویژه",
  new: "جدید",
  bestseller: "پرفروش",
  offer: "تخفیف",
};

export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  // 3D tilt on hover
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), {
    stiffness: 200,
    damping: 18,
  });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), {
    stiffness: 200,
    damping: 18,
  });

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onLeave() {
    mx.set(0);
    my.set(0);
  }

  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0;

  function quickAdd(e: React.MouseEvent) {
    e.preventDefault();
    add(product, product.colors[0], 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      className="group card-luxe h-full hover:border-white/20 hover:shadow-luxe"
    >
      <Link href={`/products/${product.slug}`} className="block h-full">
        {/* Art */}
        <div className="relative aspect-square overflow-hidden">
          <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-105">
            <ProductMedia product={product} />
          </div>

          {/* badges */}
          <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
            {discount > 0 && (
              <span className="rounded-md bg-rose-500/90 px-2 py-0.5 text-[11px] font-bold text-white shadow">
                {formatDiscount(discount)}‑
              </span>
            )}
            {product.badges
              .filter((b) => b !== "offer")
              .slice(0, 1)
              .map((b) => (
                <span
                  key={b}
                  className="rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-silver-100 backdrop-blur"
                >
                  {BADGE_LABEL[b]}
                </span>
              ))}
          </div>

          {/* quick add */}
          <button
            onClick={quickAdd}
            aria-label="افزودن سریع به سبد"
            className="absolute bottom-3 left-3 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink-900 shadow-lg transition-all duration-300 hover:scale-110 active:scale-95"
          >
            {added ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </button>
        </div>

        {/* body */}
        <div className="space-y-2 p-4">
          <div className="flex items-center gap-1 text-xs text-silver-400">
            <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
            <span className="num">{toFa(product.rating.toFixed(1))}</span>
            <span className="text-silver-500">
              ({toFa(product.reviews)} نظر)
            </span>
          </div>

          <h3 className="line-clamp-1 text-sm font-semibold text-silver-50">
            {product.name}
          </h3>
          <p className="line-clamp-1 text-xs text-silver-400">
            {product.shortDesc}
          </p>

          {/* colors */}
          <div className="flex items-center gap-1.5 pt-1">
            {product.colors.slice(0, 4).map((c) => (
              <span
                key={c.hex}
                title={c.name}
                className="h-3.5 w-3.5 rounded-full border border-white/20"
                style={{ background: c.hex }}
              />
            ))}
          </div>

          {/* price */}
          <div className="flex items-end justify-between pt-2">
            <div className="flex flex-col">
              {product.oldPrice && (
                <span className="num text-xs text-silver-500 line-through">
                  {formatPrice(product.oldPrice)}
                </span>
              )}
              <span className="num text-sm font-bold text-metal">
                {formatPrice(product.price)}
              </span>
            </div>
            {product.stock <= 25 && (
              <span className="text-[11px] text-amber-300/80">
                تنها {toFa(product.stock)} عدد
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
