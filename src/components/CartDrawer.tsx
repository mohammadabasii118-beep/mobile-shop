import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCart } from '../context/CartContext'
import { formatToman } from '../data/products'
import ProductArt from './art/ProductArt'
import { getLenis } from '../lib/useLenis'

export default function CartDrawer() {
  const { isOpen, close, lines, count, subtotal, setQty, remove, clear } =
    useCart()
  const [placed, setPlaced] = useState(false)

  useEffect(() => {
    const lenis = getLenis()
    if (isOpen) {
      lenis?.stop()
      document.body.style.overflow = 'hidden'
    } else {
      lenis?.start()
      document.body.style.overflow = ''
      setPlaced(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  const shipping = subtotal > 0 && subtotal < 2000000 ? 59000 : 0
  const total = subtotal + shipping

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[95]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
            onClick={close}
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="glass absolute inset-y-0 left-0 flex w-full max-w-md flex-col border-l border-white/10"
            data-lenis-prevent
          >
            {/* header */}
            <div className="flex items-center justify-between border-b border-white/8 p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                سبد خرید
                <span className="font-latin rounded-full bg-white/10 px-2 py-0.5 text-xs text-silver-200">
                  {count}
                </span>
              </h2>
              <button
                onClick={close}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white hover:bg-white/10"
                aria-label="بستن"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* body */}
            {placed ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-accent/20 text-accent">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white">سفارش ثبت شد</h3>
                <p className="text-sm text-silver-300">
                  این یک نسخه نمایشی است. در نسخه نهایی، اینجا به درگاه پرداخت
                  متصل می‌شوید.
                </p>
                <button
                  onClick={close}
                  className="mt-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-ink-950"
                >
                  بازگشت به فروشگاه
                </button>
              </div>
            ) : lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-white/5 text-silver-300">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" strokeLinejoin="round" />
                    <path d="M3 6h18" />
                  </svg>
                </div>
                <p className="text-silver-300">سبد خرید شما خالی است.</p>
                <button
                  onClick={close}
                  className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-bold text-white hover:bg-white/5"
                >
                  شروع خرید
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-5">
                  {lines.map((l) => (
                    <div
                      key={`${l.id}-${l.color}`}
                      className="flex gap-3 rounded-2xl border border-white/8 bg-ink-800/60 p-3"
                    >
                      <div className="grid h-20 w-16 shrink-0 place-items-center rounded-xl bg-ink-900">
                        <ProductArt
                          art={l.product.art}
                          color={l.product.colors[0]?.hex}
                          className="h-16 w-auto"
                        />
                      </div>
                      <div className="flex flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-bold text-white">
                            {l.product.name}
                          </h3>
                          <button
                            onClick={() => remove(l.id, l.color)}
                            className="text-silver-400 hover:text-white"
                            aria-label="حذف"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                        <span className="text-xs text-silver-400">{l.color}</span>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-0.5">
                            <button
                              onClick={() => setQty(l.id, l.color, l.qty - 1)}
                              className="grid h-7 w-7 place-items-center rounded-full text-white hover:bg-white/10"
                              aria-label="کاهش"
                            >
                              −
                            </button>
                            <span className="font-latin w-5 text-center text-sm text-white">
                              {l.qty}
                            </span>
                            <button
                              onClick={() => setQty(l.id, l.color, l.qty + 1)}
                              className="grid h-7 w-7 place-items-center rounded-full text-white hover:bg-white/10"
                              aria-label="افزایش"
                            >
                              +
                            </button>
                          </div>
                          <span className="font-latin text-sm font-bold text-white">
                            {formatToman(l.lineTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={clear}
                    className="w-full py-2 text-center text-xs text-silver-400 hover:text-white"
                  >
                    خالی کردن سبد
                  </button>
                </div>

                {/* footer */}
                <div className="space-y-3 border-t border-white/8 p-5">
                  <div className="flex items-center justify-between text-sm text-silver-300">
                    <span>جمع محصولات</span>
                    <span className="font-latin">{formatToman(subtotal)} تومان</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-silver-300">
                    <span>هزینه ارسال</span>
                    <span className="font-latin">
                      {shipping === 0 ? 'رایگان' : `${formatToman(shipping)} تومان`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/8 pt-3 text-base font-bold text-white">
                    <span>مبلغ قابل پرداخت</span>
                    <span className="font-latin">{formatToman(total)} تومان</span>
                  </div>
                  <button
                    onClick={() => setPlaced(true)}
                    className="btn-sheen w-full rounded-full bg-white py-3.5 text-sm font-bold text-ink-950 transition-transform hover:scale-[1.02] active:scale-95"
                  >
                    تکمیل خرید
                  </button>
                  <p className="text-center text-[11px] text-silver-400">
                    پرداخت امن · آماده اتصال به درگاه
                  </p>
                </div>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
