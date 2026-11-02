"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { X, Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { formatPrice, toFa } from "@/lib/format";
import ProductArt from "@/components/ui/ProductArt";

export default function CartDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { items, subtotal, setQty, remove, count } = useCart();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 left-0 z-[90] flex w-[88%] max-w-md flex-col bg-ink-900 shadow-luxe"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            aria-label="سبد خرید"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] p-4">
              <h2 className="flex items-center gap-2 font-bold text-silver-50">
                <ShoppingBag className="h-5 w-5 text-accent" />
                سبد خرید
                <span className="num text-sm text-silver-400">
                  ({toFa(count)})
                </span>
              </h2>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-lg text-silver-200 hover:bg-white/5"
                aria-label="بستن"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <ShoppingBag className="h-12 w-12 text-silver-600" />
                <p className="text-sm text-silver-400">سبد خرید خالی است.</p>
                <Link href="/products" onClick={onClose} className="btn-ghost mt-2">
                  رفتن به فروشگاه
                </Link>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {items.map((it) => (
                    <div
                      key={`${it.id}-${it.color.hex}`}
                      className="flex gap-3 rounded-xl border border-white/[0.06] p-2"
                    >
                      <Link
                        href={`/products/${it.slug}`}
                        onClick={onClose}
                        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg"
                      >
                        <ProductArt hue={it.hue} categorySlug="accessories" />
                      </Link>
                      <div className="flex flex-1 flex-col">
                        <div className="flex items-start justify-between gap-1">
                          <Link
                            href={`/products/${it.slug}`}
                            onClick={onClose}
                            className="line-clamp-1 text-xs font-semibold text-silver-50 hover:text-white"
                          >
                            {it.name}
                          </Link>
                          <button
                            onClick={() => remove(it.id, it.color.hex)}
                            className="text-silver-500 hover:text-rose-400"
                            aria-label="حذف"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center rounded-lg border border-white/10">
                            <button
                              onClick={() => setQty(it.id, it.color.hex, it.qty - 1)}
                              className="grid h-7 w-7 place-items-center text-silver-300 hover:text-white"
                              aria-label="کاهش"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="num w-7 text-center text-xs text-silver-50">
                              {toFa(it.qty)}
                            </span>
                            <button
                              onClick={() => setQty(it.id, it.color.hex, it.qty + 1)}
                              className="grid h-7 w-7 place-items-center text-silver-300 hover:text-white"
                              aria-label="افزایش"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="num text-xs font-bold text-metal">
                            {formatPrice(it.price * it.qty)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/[0.06] p-4">
                  <div className="mb-3 flex justify-between text-sm">
                    <span className="text-silver-300">جمع کل</span>
                    <span className="num font-bold text-metal">
                      {formatPrice(subtotal)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/cart"
                      onClick={onClose}
                      className="btn-ghost justify-center"
                    >
                      سبد کامل
                    </Link>
                    <Link
                      href="/checkout"
                      onClick={onClose}
                      className="btn-luxe justify-center"
                    >
                      تسویه
                      <ArrowLeft className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
