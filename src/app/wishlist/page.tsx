"use client";

import Link from "next/link";
import { Heart, ArrowLeft, Trash2 } from "lucide-react";
import { useWishlist } from "@/lib/wishlist-context";
import { getProductById } from "@/lib/products";
import ProductCard from "@/components/product/ProductCard";
import { toFa } from "@/lib/format";

export default function WishlistPage() {
  const { ids, clear, count } = useWishlist();
  const items = ids.map(getProductById).filter(Boolean);

  if (count === 0) {
    return (
      <div className="mx-auto grid max-w-7xl place-items-center px-4 py-24 text-center sm:px-6">
        <Heart className="mb-4 h-14 w-14 text-silver-600" />
        <h1 className="text-2xl font-black text-silver-50">
          لیست علاقه‌مندی‌ها خالی است
        </h1>
        <p className="mt-2 text-sm text-silver-400">
          با زدن آیکون قلب روی محصولات، آن‌ها را اینجا ذخیره کنید.
        </p>
        <Link href="/products" className="btn-luxe mt-6">
          مشاهده محصولات
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black text-silver-50 sm:text-3xl">
          علاقه‌مندی‌ها{" "}
          <span className="num text-base text-silver-400">({toFa(count)})</span>
        </h1>
        <button
          onClick={clear}
          className="flex items-center gap-1.5 text-xs text-silver-500 transition hover:text-rose-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
          خالی کردن
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {items.map(
          (p) => p && <ProductCard key={p.id} product={p} />
        )}
      </div>
    </div>
  );
}
