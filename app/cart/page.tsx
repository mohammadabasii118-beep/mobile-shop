"use client";
import Link from "next/link";
import Image from "next/image";
import { useCart, lineKey } from "@/components/CartContext";
import { fmtToman, fa } from "@/lib/format";

export default function CartPage() {
  const { lines, changeQty, removeFromCart, total, count } = useCart();

  if (lines.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <p className="text-lg font-bold mb-2">سبد خرید شما خالی است</p>
        <p className="muted text-sm mb-6">محصولی برای نمایش وجود ندارد.</p>
        <Link href="/" className="inline-block px-8 h-12 leading-[48px] rounded-full text-white font-bold" style={{ background: "var(--ink)" }}>بازگشت به فروشگاه</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-10">
      <h1 className="text-2xl font-extrabold mb-6">سبد خرید ({fa(count)} کالا)</h1>
      <div className="flex flex-col gap-5 mb-8">
        {lines.map((l) => {
          const key = lineKey(l);
          return (
            <div key={key} className="flex gap-4 surface border line rounded-2xl p-4">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-[var(--surface-2)] shrink-0">
                {l.image && <Image src={l.image} alt={l.name} fill className="object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium mb-1">{l.name}</div>
                {l.variantLabel && <div className="text-xs muted mb-1">{l.variantLabel}</div>}
                <div className="text-xs muted mb-2">{fmtToman(l.price)}</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => changeQty(key, -1)} className="w-8 h-8 rounded-full surface2 border line">−</button>
                  <span className="text-sm w-6 text-center">{fa(l.qty)}</span>
                  <button onClick={() => changeQty(key, 1)} className="w-8 h-8 rounded-full surface2 border line">＋</button>
                  <button onClick={() => removeFromCart(key)} className="text-xs muted mr-3">حذف</button>
                </div>
              </div>
              <div className="text-sm font-bold whitespace-nowrap">{fmtToman(l.price * l.qty)}</div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between border-t line pt-6">
        <span className="font-bold text-lg">جمع کل: {fmtToman(total)}</span>
        <Link href="/checkout" className="px-8 h-12 leading-[48px] rounded-full text-white font-bold" style={{ background: "var(--ink)" }}>ادامه فرآیند خرید</Link>
      </div>
    </div>
  );
}
