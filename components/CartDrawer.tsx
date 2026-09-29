"use client";
import Link from "next/link";
import Image from "next/image";
import { useCart, lineKey } from "./CartContext";
import { fmtToman, fa } from "@/lib/format";

export default function CartDrawer() {
  const { lines, cartOpen, setCartOpen, changeQty, count, total } = useCart();

  return (
    <div className={`fixed inset-0 z-50 ${cartOpen ? "" : "pointer-events-none"}`}>
      <div onClick={() => setCartOpen(false)} className={`absolute inset-0 bg-black/40 transition-opacity ${cartOpen ? "opacity-100" : "opacity-0"}`} />
      <div
        className="absolute top-0 left-0 h-full w-[88%] max-w-sm surface flex flex-col transition-transform"
        style={{ transform: `translateX(${cartOpen ? "0" : "-100%"})` }}
      >
        <div className="flex items-center justify-between p-5 border-b line">
          <span className="font-extrabold text-lg">سبد خرید ({fa(count)})</span>
          <button onClick={() => setCartOpen(false)} className="w-9 h-9 rounded-full surface2 flex items-center justify-center">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {lines.length === 0 && <div className="text-center muted text-sm py-16">سبد خرید شما خالی است</div>}
          {lines.map((l) => {
            const key = lineKey(l);
            return (
              <div key={key} className="flex gap-3">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-[var(--surface-2)] shrink-0">
                  {l.image && <Image src={l.image} alt={l.name} fill className="object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium clamp2 leading-5">{l.name}</div>
                  {l.variantLabel && <div className="text-xs muted mt-0.5">{l.variantLabel}</div>}
                  <div className="text-xs muted mt-1">{fmtToman(l.price)}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => changeQty(key, -1)} className="w-7 h-7 rounded-full surface2 border line">−</button>
                    <span className="text-sm w-5 text-center">{fa(l.qty)}</span>
                    <button onClick={() => changeQty(key, 1)} className="w-7 h-7 rounded-full surface2 border line">＋</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {lines.length > 0 && (
          <div className="p-5 border-t line">
            <div className="flex justify-between text-sm mb-4"><span>جمع کل</span><span className="font-bold">{fmtToman(total)}</span></div>
            <Link href="/checkout" onClick={() => setCartOpen(false)} className="w-full h-12 rounded-full text-white font-bold flex items-center justify-center" style={{ background: "var(--ink)" }}>
              ادامه فرآیند خرید
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
