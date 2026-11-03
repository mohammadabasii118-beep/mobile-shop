import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Product } from '../../data/products'
import { formatToman } from '../../data/products'
import ProductArt from '../art/ProductArt'
import { useCart } from '../../context/CartContext'
import { getLenis } from '../../lib/useLenis'

interface Props {
  product: Product | null
  onClose: () => void
}

export default function ProductModal({ product, onClose }: Props) {
  const { add } = useCart()
  const [colorIdx, setColorIdx] = useState(0)
  const [qty, setQty] = useState(1)

  useEffect(() => {
    setColorIdx(0)
    setQty(1)
  }, [product])

  useEffect(() => {
    if (!product) return
    const lenis = getLenis()
    lenis?.stop()
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      lenis?.start()
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [product, onClose])

  return (
    <AnimatePresence>
      {product && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={product.name}
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="glass relative z-10 grid max-h-[92svh] w-full max-w-4xl grid-cols-1 overflow-y-auto rounded-t-3xl border border-white/10 sm:rounded-3xl md:grid-cols-2"
          >
            {/* close */}
            <button
              onClick={onClose}
              className="absolute left-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-ink-900/70 text-white transition-colors hover:bg-ink-800"
              aria-label="بستن"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>

            {/* media */}
            <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden bg-gradient-to-b from-ink-800 to-ink-900 p-8">
              <div className="studio-glow absolute inset-0" />
              <ProductArt
                art={product.art}
                color={product.colors[colorIdx]?.hex}
                className="relative h-[280px] w-auto max-w-[75%] drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
              />
            </div>

            {/* details */}
            <div className="flex flex-col gap-5 p-6 sm:p-8">
              <div>
                <div className="flex items-center gap-2 text-xs text-silver-400">
                  <span className="font-latin flex items-center gap-1">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-amber-300" fill="currentColor">
                      <path d="M12 2l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 16.9 6.1 19.9l1.1-6.47L2.5 8.85l6.5-.95z" />
                    </svg>
                    {product.rating}
                  </span>
                  <span>·</span>
                  <span>{product.reviews} نظر</span>
                </div>
                <h2 className="mt-2 text-2xl font-extrabold text-white">
                  {product.name}
                </h2>
                <p className="mt-1 text-sm text-accent-soft">{product.tagline}</p>
              </div>

              <p className="text-sm leading-7 text-silver-300">
                {product.description}
              </p>

              {/* features */}
              <ul className="flex flex-wrap gap-2">
                {product.features.map((f) => (
                  <li
                    key={f}
                    className="rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs text-silver-200"
                  >
                    {f}
                  </li>
                ))}
              </ul>

              {/* colors */}
              {product.colors.length > 1 && (
                <div>
                  <span className="text-xs text-silver-400">
                    رنگ: {product.colors[colorIdx]?.name}
                  </span>
                  <div className="mt-2 flex gap-2">
                    {product.colors.map((c, i) => (
                      <button
                        key={c.name}
                        onClick={() => setColorIdx(i)}
                        className={
                          'h-8 w-8 rounded-full border-2 transition ' +
                          (i === colorIdx
                            ? 'border-white scale-110'
                            : 'border-white/20')
                        }
                        style={{ backgroundColor: c.hex }}
                        aria-label={c.name}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* qty + price */}
              <div className="mt-auto flex items-center justify-between gap-4 border-t border-white/8 pt-5">
                <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 p-1">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="grid h-9 w-9 place-items-center rounded-full text-white hover:bg-white/10"
                    aria-label="کاهش"
                  >
                    −
                  </button>
                  <span className="font-latin w-6 text-center text-white">{qty}</span>
                  <button
                    onClick={() => setQty((q) => q + 1)}
                    className="grid h-9 w-9 place-items-center rounded-full text-white hover:bg-white/10"
                    aria-label="افزایش"
                  >
                    +
                  </button>
                </div>
                <div className="text-left">
                  {product.oldPrice && (
                    <span className="font-latin block text-xs text-silver-400 line-through">
                      {formatToman(product.oldPrice)}
                    </span>
                  )}
                  <span className="font-latin text-xl font-bold text-white">
                    {formatToman(product.price * qty)}
                    <span className="mr-1 text-xs font-normal text-silver-400">
                      تومان
                    </span>
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  add(
                    product.id,
                    product.colors[colorIdx]?.name ?? 'پیش‌فرض',
                    qty,
                  )
                  onClose()
                }}
                className="btn-sheen w-full rounded-full bg-white py-3.5 text-sm font-bold text-ink-950 transition-transform hover:scale-[1.02] active:scale-95"
              >
                افزودن به سبد خرید
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
