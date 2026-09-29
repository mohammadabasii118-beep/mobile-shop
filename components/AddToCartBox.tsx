"use client";
import { useState } from "react";
import { useCart } from "./CartContext";
import { fa, fmtToman } from "@/lib/format";

export default function AddToCartBox({ product, inStock }: { product: { id: string; name: string; price: number; image: string }; inStock: boolean }) {
  const { addToCart, setCartOpen } = useCart();
  const [qty, setQty] = useState(1);

  function handleAdd() {
    addToCart({ productId: product.id, name: product.name, price: product.price, image: product.image }, qty);
    setCartOpen(true);
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <span className="text-sm font-medium">تعداد</span>
        <div className="flex items-center gap-3 border line rounded-full px-2 h-11">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-7 h-7 flex items-center justify-center">−</button>
          <span className="w-6 text-center">{fa(qty)}</span>
          <button onClick={() => setQty((q) => q + 1)} className="w-7 h-7 flex items-center justify-center">＋</button>
        </div>
      </div>

      {/* Desktop / tablet buy button — hidden on mobile in favor of the sticky bar below */}
      {inStock ? (
        <button
          onClick={handleAdd}
          className="hidden md:inline-block px-10 h-[52px] rounded-full text-white font-bold"
          style={{ background: "var(--ink)" }}
        >
          افزودن به سبد خرید
        </button>
      ) : (
        <span className="hidden md:inline-block px-6 h-[52px] leading-[52px] rounded-full surface2 muted text-sm">ناموجود</span>
      )}

      {/* Mobile sticky buy bar — keeps price + add-to-cart reachable without scrolling back up */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 surface border-t line px-4 py-3 flex items-center gap-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <span className="font-extrabold text-sm shrink-0">{fmtToman(product.price)}</span>
        {inStock ? (
          <button onClick={handleAdd} className="flex-1 h-12 rounded-full text-white font-bold text-sm" style={{ background: "var(--ink)" }}>
            افزودن به سبد خرید
          </button>
        ) : (
          <span className="flex-1 h-12 leading-[3rem] text-center rounded-full surface2 muted text-sm">ناموجود</span>
        )}
      </div>
      {/* Spacer so page content isn't hidden behind the fixed mobile bar */}
      <div className="md:hidden h-16" aria-hidden="true" />
    </div>
  );
}
