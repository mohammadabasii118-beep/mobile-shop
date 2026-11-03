import { motion } from 'framer-motion'
import { categories } from '../../data/products'
import ProductArt from '../art/ProductArt'
import SectionHeading from './SectionHeading'
import { scrollToId } from '../../lib/scrollTo'

export default function CategoryShowcase() {
  return (
    <section className="mx-auto max-w-8xl px-5 py-16 sm:px-8 sm:py-20">
      <SectionHeading
        eyebrow="دسته‌بندی‌ها"
        title="مجموعه‌ها را کاوش کنید"
        subtitle="از محافظت تا انرژی و صدا — هر آنچه لازم دارید، دسته‌بندی‌شده و دقیق."
      />

      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {categories.map((c, i) => (
          <motion.button
            key={c.id}
            onClick={() => scrollToId('shop', -70)}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className={
              'group relative flex flex-col items-center overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-b from-ink-800/70 to-ink-900 p-6 text-center transition-colors hover:border-white/20 ' +
              (i === 0 ? 'col-span-2 md:col-span-1' : '')
            }
          >
            <div className="studio-glow absolute inset-0 opacity-60 transition-opacity group-hover:opacity-100" />
            <div className="relative grid h-28 w-full place-items-center">
              <ProductArt
                art={c.art}
                className="h-24 w-auto drop-shadow-[0_18px_30px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-105"
              />
            </div>
            <h3 className="relative mt-4 text-base font-bold text-white">
              {c.title}
            </h3>
            <p className="relative mt-1 text-xs text-silver-400">{c.subtitle}</p>
          </motion.button>
        ))}
      </div>
    </section>
  )
}
