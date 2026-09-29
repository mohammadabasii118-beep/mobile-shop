"use client";
import Link from "next/link";
import Image from "next/image";
import { fmtToman, fa } from "@/lib/format";
import { useCart } from "./CartContext";
import CompareButton from "./CompareButton";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  price: number;
  oldPrice?: number | null;
  images: string[];
  isBestSeller?: boolean;
  isNew?: boolean;
  isTrending?: boolean;
  hasVariants?: boolean;
  avgRating?: number | null;
  reviewCount?: number;
};

function badgeStyle(kind: "best" | "new" | "trend") {
  if (kind === "best") return { background: "var(--ink)", color: "var(--bg)" };
  if (kind === "new") return { background: "#404040", color: "#fff" };
  return { background: "#6b6b6b", color: "#fff" };
}

export default function ProductCard({ p }: { p: ProductCardData }) {
  const { addToCart } = useCart();
  const disc = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  const badge = p.isBestSeller ? "پرفروش" : p.isNew ? "جدید" : p.isTrending ? "ترند" : null;
  const badgeKind = p.isBestSeller ? "best" : p.isNew ? "new" : "trend";

  return (
    <div>
      <Link href={`/product/${p.slug}`} className="block">
        <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-[var(--surface-2)] mb-3">
          {p.images?.[0] && (
            <Image src={p.images[0]} alt={p.name} fill sizes="240px" className="object-cover" />
          )}
          {badge && (
            <span className="absolute top-3 right-3 text-[10px] px-2 py-1 rounded-full font-medium" style={badgeStyle(badgeKind as any)}>
              {badge}
            </span>
          )}
          {disc > 0 && (
            <span className="absolute top-3 left-3 text-[10px] px-2 py-1 rounded-full font-bold text-white" style={{ background: "var(--ink)" }}>
              {fa(disc)}٪-
            </span>
          )}
          <div className="absolute bottom-2 left-2">
            <CompareButton productId={p.id} />
          </div>
        </div>
        <h3 className="text-sm font-medium clamp2 leading-6 mb-1">{p.name}</h3>
        {/* Only real, non-zero rating data ever renders here — a product
            with no reviews yet shows nothing, never a fake "0" or "5.0". */}
        {!!p.avgRating && !!p.reviewCount && (
          <div className="flex items-center gap-1 mb-1" aria-label={`امتیاز ${p.avgRating.toFixed(1)} از ۵، بر اساس ${fa(p.reviewCount)} نظر`}>
            <span className="text-amber-500 text-xs" aria-hidden="true">★</span>
            <span className="text-xs muted">{p.avgRating.toFixed(1)} ({fa(p.reviewCount)})</span>
          </div>
        )}
      </Link>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {p.oldPrice ? <span className="text-xs muted line-through">{fmtToman(p.oldPrice)}</span> : null}
          <span className="text-sm font-bold">{p.hasVariants ? `از ${fmtToman(p.price)}` : fmtToman(p.price)}</span>
        </div>
        {p.hasVariants ? (
          <Link
            href={`/product/${p.slug}`}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm shrink-0"
            style={{ background: "var(--ink)" }}
            aria-label="مشاهده گزینه‌ها"
          >
            ←
          </Link>
        ) : (
          <button
            onClick={() =>
              addToCart({ productId: p.id, name: p.name, price: p.price, image: p.images?.[0] || "" })
            }
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm shrink-0"
            style={{ background: "var(--ink)" }}
            aria-label="افزودن به سبد خرید"
          >
            ＋
          </button>
        )}
      </div>
    </div>
  );
}
