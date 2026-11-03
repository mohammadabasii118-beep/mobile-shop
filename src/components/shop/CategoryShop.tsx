import { useMemo, useState } from 'react'
import type { CategoryId, Product } from '../../data/products'
import { categories, products } from '../../data/products'
import ProductArt from '../art/ProductArt'
import ProductCard from './ProductCard'
import SectionHeading from './SectionHeading'

interface Props {
  onOpen: (p: Product) => void
}

type Filter = CategoryId | 'all'

export default function CategoryShop({ onOpen }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const shown = useMemo(
    () =>
      filter === 'all'
        ? products
        : products.filter((p) => p.category === filter),
    [filter],
  )

  return (
    <section id="shop" className="mx-auto max-w-8xl px-5 py-16 sm:px-8 sm:py-24">
      <SectionHeading
        center
        eyebrow="فروشگاه"
        title="همه چیز برای آیفون شما"
        subtitle="دسته‌بندی مورد نظرتان را انتخاب کنید و مجموعه را کشف کنید."
      />

      {/* category pills with mini-art */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => setFilter('all')}
          className={
            'rounded-full px-5 py-2.5 text-sm font-semibold transition-all ' +
            (filter === 'all'
              ? 'bg-white text-ink-950'
              : 'border border-white/10 bg-white/5 text-silver-200 hover:bg-white/10')
          }
        >
          همه محصولات
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={
              'flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all ' +
              (filter === c.id
                ? 'bg-white text-ink-950'
                : 'border border-white/10 bg-white/5 text-silver-200 hover:bg-white/10')
            }
          >
            <ProductArt art={c.art} className="h-6 w-6" />
            {c.title}
          </button>
        ))}
      </div>

      {/* grid */}
      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((p) => (
          <ProductCard key={p.id} product={p} onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}
