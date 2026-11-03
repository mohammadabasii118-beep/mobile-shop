import type { Product } from '../../data/products'
import { bestsellers, newArrivals } from '../../data/products'
import ProductCard from './ProductCard'
import SectionHeading from './SectionHeading'

interface Props {
  onOpen: (p: Product) => void
}

function Rail({
  id,
  eyebrow,
  title,
  subtitle,
  items,
  onOpen,
}: {
  id?: string
  eyebrow: string
  title: string
  subtitle: string
  items: Product[]
  onOpen: (p: Product) => void
}) {
  return (
    <section id={id} className="mx-auto max-w-8xl px-5 py-16 sm:px-8 sm:py-20">
      <SectionHeading
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
      />
      <div
        className="mt-10 grid grid-flow-col auto-cols-[78%] gap-5 overflow-x-auto pb-4 sm:auto-cols-[46%] lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-4 lg:overflow-visible"
        data-lenis-prevent
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {items.map((p) => (
          <div key={p.id} style={{ scrollSnapAlign: 'start' }}>
            <ProductCard product={p} onOpen={onOpen} />
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Highlights({ onOpen }: Props) {
  return (
    <>
      <Rail
        id="bestsellers"
        eyebrow="محبوب‌ترین‌ها"
        title="محصولات پرفروش"
        subtitle="انتخاب هزاران کاربر؛ لوازمی که بیشترین تحسین را گرفته‌اند."
        items={bestsellers}
        onOpen={onOpen}
      />
      <Rail
        eyebrow="تازه رسیده‌ها"
        title="جدیدترین محصولات"
        subtitle="آخرین نسل لوازم جانبی، پیش از همه در دستان شما."
        items={newArrivals}
        onOpen={onOpen}
      />
    </>
  )
}
