import type { Product } from '@/types';
import { ProductCard } from './ProductCard';
import { FadeIn } from './FadeIn';

export function ProductGrid({ items }: { items: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((p, i) => (
        <FadeIn key={p.id} delay={(i % 4) * 0.06} y={20}><ProductCard product={p} /></FadeIn>
      ))}
    </div>
  );
}
