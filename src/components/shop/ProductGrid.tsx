import type { CardData } from '@/lib/types';
import ProductCard from './ProductCard';

export default function ProductGrid({ items, low = 5, cols = 4 }: { items: CardData[]; low?: number; cols?: 3 | 4 }) {
  return (
    <div className={`grid g${cols}`}>
      {items.map((p) => <ProductCard key={p.id} p={p} low={low} />)}
    </div>
  );
}
