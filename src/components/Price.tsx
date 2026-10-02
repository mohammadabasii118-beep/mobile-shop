import { discountPercent, formatPrice } from '@/utils/format';

export function Price({ price, oldPrice, size = 'md' }: { price: number; oldPrice?: number; size?: 'md' | 'lg' }) {
  const off = discountPercent(price, oldPrice);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className={`font-black text-white ${size === 'lg' ? 'text-2xl' : 'text-sm sm:text-base'}`}>{formatPrice(price)}</span>
      {oldPrice && off > 0 && <span className="text-xs text-mist/40 line-through">{formatPrice(oldPrice)}</span>}
    </div>
  );
}
