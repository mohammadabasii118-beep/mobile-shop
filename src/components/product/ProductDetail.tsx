"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import {
  Star,
  Minus,
  Plus,
  ShoppingBag,
  Heart,
  Check,
  Box,
  Image as ImageIcon,
  ShieldCheck,
  Truck,
  ArrowLeft,
} from "lucide-react";
import type { Product } from "@/lib/products";
import { categoryBySlug } from "@/lib/products";
import { formatPrice, formatDiscount, toFa } from "@/lib/format";
import { useCart } from "@/lib/cart-context";
import { useWishlist } from "@/lib/wishlist-context";
import ProductMedia from "@/components/ui/ProductMedia";

const ProductViewer3D = dynamic(() => import("./ProductViewer3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
    </div>
  ),
});

export default function ProductDetail({ product }: { product: Product }) {
  const { add } = useCart();
  const { has, toggle } = useWishlist();
  const liked = has(product.id);
  const [color, setColor] = useState(product.colors[0]);
  const [qty, setQty] = useState(1);
  const [mode, setMode] = useState<"art" | "3d">("art");
  const [added, setAdded] = useState(false);

  const gallery = [product.image, ...(product.gallery ?? [])].filter(
    Boolean
  ) as string[];
  const [activeImg, setActiveImg] = useState<string | undefined>(product.image);

  const cat = categoryBySlug(product.categorySlug);
  const discount = product.oldPrice
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0;

  function handleAdd() {
    add(product, color, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-6 flex items-center gap-1 text-xs text-silver-500">
        <Link href="/" className="hover:text-silver-300">خانه</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-silver-300">فروشگاه</Link>
        <span>/</span>
        <Link
          href={`/products?cat=${product.categorySlug}`}
          className="hover:text-silver-300"
        >
          {cat?.name}
        </Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* media */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-white/[0.07] bg-ink-850">
            {mode === "art" ? (
              <ProductMedia product={product} src={activeImg} priority />
            ) : (
              <ProductViewer3D
                categorySlug={product.categorySlug}
                color={color.hex}
                modelUrl={product.model}
              />
            )}
            {discount > 0 && (
              <span className="absolute right-4 top-4 rounded-lg bg-rose-500/90 px-2.5 py-1 text-xs font-bold text-white">
                {formatDiscount(discount)}‑ تخفیف
              </span>
            )}
          </div>

          {/* media toggle */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setMode("art")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm transition ${
                mode === "art"
                  ? "border-white/25 bg-white/[0.06] text-white"
                  : "border-white/10 text-silver-400 hover:border-white/20"
              }`}
            >
              <ImageIcon className="h-4 w-4" /> نمای تصویری
            </button>
            <button
              onClick={() => setMode("3d")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm transition ${
                mode === "3d"
                  ? "border-white/25 bg-white/[0.06] text-white"
                  : "border-white/10 text-silver-400 hover:border-white/20"
              }`}
            >
              <Box className="h-4 w-4" /> نمای سه‌بعدی
            </button>
          </div>
          {/* multi-angle gallery thumbnails (shown when real images exist) */}
          {gallery.length > 1 && mode === "art" && (
            <div className="mt-3 flex gap-2">
              {gallery.map((g) => (
                <button
                  key={g}
                  onClick={() => setActiveImg(g)}
                  aria-label="تغییر زاویهٔ تصویر"
                  className={`relative h-16 w-16 overflow-hidden rounded-xl border transition ${
                    activeImg === g
                      ? "border-accent"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <ProductMedia product={product} src={g} sizes="64px" />
                </button>
              ))}
            </div>
          )}

          <p className="mt-2 text-center text-[11px] text-silver-600">
            {product.model
              ? "نمای سه‌بعدی واقعی محصول — برای چرخش بکشید."
              : "نمای سه‌بعدی یک بازنمایی تزئینی و قابل‌چرخش است، نه مدل اسکن‌شده‌ی محصول واقعی."}
          </p>
        </div>

        {/* info */}
        <div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {product.badges.map((b) => (
              <span key={b} className="chip">
                {{ featured: "ویژه", new: "جدید", bestseller: "پرفروش", offer: "تخفیف" }[b]}
              </span>
            ))}
          </div>

          <h1 className="text-2xl font-black text-silver-50 sm:text-3xl">
            {product.name}
          </h1>

          <div className="mt-3 flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-amber-300">
              <Star className="h-4 w-4 fill-amber-300" />
              <span className="num">{toFa(product.rating.toFixed(1))}</span>
            </span>
            <span className="text-silver-500">
              ({toFa(product.reviews)} دیدگاه)
            </span>
            <span className="text-silver-600">•</span>
            <span
              className={product.stock > 0 ? "text-emerald-400" : "text-rose-400"}
            >
              {product.stock > 0
                ? `موجود (${toFa(product.stock)} عدد)`
                : "ناموجود"}
            </span>
          </div>

          <p className="mt-5 leading-8 text-silver-300">{product.description}</p>

          {/* price */}
          <div className="mt-6 flex items-end gap-3">
            <span className="num text-3xl font-black text-metal">
              {formatPrice(product.price)}
            </span>
            {product.oldPrice && (
              <span className="num mb-1 text-base text-silver-500 line-through">
                {formatPrice(product.oldPrice)}
              </span>
            )}
          </div>

          {/* colors */}
          <div className="mt-6">
            <div className="mb-2 text-sm text-silver-300">
              رنگ: <span className="text-silver-100">{color.name}</span>
            </div>
            <div className="flex gap-2">
              {product.colors.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setColor(c)}
                  title={c.name}
                  className={`h-9 w-9 rounded-full border-2 transition ${
                    color.hex === c.hex
                      ? "border-accent ring-2 ring-accent/30"
                      : "border-white/20 hover:border-white/40"
                  }`}
                  style={{ background: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* qty + add */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.03]">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="grid h-11 w-11 place-items-center text-silver-200 hover:text-white"
                aria-label="کاهش"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="num w-10 text-center text-sm font-bold text-silver-50">
                {toFa(qty)}
              </span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="grid h-11 w-11 place-items-center text-silver-200 hover:text-white"
                aria-label="افزایش"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button onClick={handleAdd} className="btn-luxe flex-1">
              {added ? (
                <>
                  <Check className="h-4 w-4" /> به سبد اضافه شد
                </>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" /> افزودن به سبد خرید
                </>
              )}
            </button>

            <button
              onClick={() => toggle(product.id)}
              aria-pressed={liked}
              className={`grid h-11 w-11 place-items-center rounded-xl border transition ${
                liked
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
                  : "border-white/10 text-silver-300 hover:border-white/25 hover:text-rose-400"
              }`}
              aria-label={liked ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
            >
              <Heart className={`h-5 w-5 ${liked ? "fill-rose-500" : ""}`} />
            </button>
          </div>

          {/* guarantees */}
          <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-silver-400">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" /> ضمانت اصالت کالا
            </span>
            <span className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-accent" /> ارسال سریع
            </span>
          </div>

          {/* specs */}
          <div className="mt-8">
            <h3 className="mb-3 text-sm font-bold text-silver-100">مشخصات فنی</h3>
            <dl className="overflow-hidden rounded-2xl border border-white/[0.07]">
              {product.specs.map((s, i) => (
                <div
                  key={s.label}
                  className={`flex items-center justify-between px-4 py-3 text-sm ${
                    i % 2 ? "bg-white/[0.02]" : ""
                  }`}
                >
                  <dt className="text-silver-400">{s.label}</dt>
                  <dd className="font-medium text-silver-100">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <Link
            href="/products"
            className="mt-8 inline-flex items-center gap-1 text-sm text-silver-400 hover:text-white"
          >
            بازگشت به فروشگاه
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
