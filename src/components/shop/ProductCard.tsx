import { motion } from 'framer-motion'
import type { Product } from '../../data/products'
import { formatToman } from '../../data/products'
import ProductArt from '../art/ProductArt'
import { useCart } from '../../context/CartContext'

interface Props {
  product: Product
  onOpen: (p: Product) => void
}

export default function ProductCard({ product, onOpen }: Props) {
  const { add } = useCart()

  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-b from-ink-800/80 to-ink-900/90"
    >
      {(product.bestseller || product.isNew) && (
        <span
          className={
            'absolute right-4 top-4 z-10 rounded-full px-3 py-1 text-[11px] font-bold ' +
            (product.isNew
              ? 'bg-accent/90 text-ink-950'
              : 'bg-white/90 text-ink-950')
          }
        >
          {product.isNew ? 'جدید' : 'پرفروش'}
        </span>
      )}

      {/* media */}
      <button
        onClick={() => onOpen(product)}
        className="relative flex aspect-[4/5] items-center justify-center overflow-hidden p-6"
        aria-label={`مشاهده ${product.name}`}
      >
        <div className="studio-glow absolute inset-0 opacity-70 transition-opacity duration-500 group-hover:opacity-100" />
        <ProductArt
          art={product.art}
          color={product.colors[0]?.hex}
          className="relative h-full w-auto max-w-[70%] drop-shadow-[0_24px_44px_rgba(0,0,0,0.55)] transition-transform duration-700 ease-out group-hover:-translate-y-2 group-hover:scale-[1.06]"
        />
      </button>

      {/* body */}
      <div className="flex flex-1 flex-col gap-3 border-t border-white/6 p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white">{product.name}</h3>
            <p className="mt-1 text-xs text-silver-400">{product.tagline}</p>
          </div>
          <span className="font-latin flex shrink-0 items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-xs text-silver-200">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-amber-300" fill="currentColor">
              <path d="M12 2l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 16.9 6.1 19.9l1.1-6.47L2.5 8.85l6.5-.95z" />
            </svg>
            {product.rating}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <div className="flex flex-col">
            {product.oldPrice && (
              <span className="font-latin text-xs text-silver-400 line-through">
                {formatToman(product.oldPrice)}
              </span>
            )}
            <span className="font-latin text-lg font-bold text-white">
              {formatToman(product.price)}
              <span className="mr-1 text-xs font-normal text-silver-400">
                تومان
              </span>
            </span>
          </div>
          <button
            onClick={() => add(product.id, product.colors[0]?.name ?? 'پیش‌فرض')}
            className="btn-sheen grid h-10 w-10 place-items-center rounded-full bg-white text-ink-950 transition-transform hover:scale-105 active:scale-95"
            aria-label="افزودن به سبد خرید"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </motion.article>
  )
}
