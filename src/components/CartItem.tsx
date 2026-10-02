import { Link } from 'react-router-dom';
import { Heart, Minus, Plus, Trash2 } from 'lucide-react';
import type { CartLine } from '@/types';
import { products } from '@/data/products';
import { categories } from '@/data/categories';
import { formatPrice, toFa } from '@/utils/format';
import { useShop } from '@/store';
import { ProductArt } from './ProductArt';

export function CartItem({ line, compact }: { line: CartLine; compact?: boolean }) {
  const p = products.find((x) => x.id === line.productId)!;
  const { setQuantity, removeFromCart, toggleWishlist, wishlist } = useShop();
  const hue = categories.find((c) => c.slug === p.category)?.hue ?? '#8B5CF6';
  const colorHex = p.colors.find((c) => c.name === line.color)?.hex ?? hue;
  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-surface2/50 p-3">
      <Link to={`/product/${p.slug}`} className={`shrink-0 rounded-xl bg-surface ${compact ? 'h-20 w-20' : 'h-24 w-24'}`}><ProductArt kind={p.art} color={colorHex} className="h-full w-full" /></Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link to={`/product/${p.slug}`} className="line-clamp-2 text-sm font-bold text-white">{p.name}</Link>
        <p className="text-[11px] text-mist/60">{line.model} · {line.color}{line.custom?.text ? ` · «${line.custom.text}»` : ''}</p>
        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-full border border-line">
            <button aria-label="افزایش" className="grid h-8 w-8 place-items-center" onClick={() => setQuantity(line.key, Math.min(p.stock, line.quantity + 1))}><Plus size={14} /></button>
            <span className="w-5 text-center text-sm font-bold text-white">{toFa(line.quantity)}</span>
            <button aria-label="کاهش" className="grid h-8 w-8 place-items-center" onClick={() => setQuantity(line.key, line.quantity - 1)}><Minus size={14} /></button>
          </div>
          <span className="text-sm font-black text-white">{formatPrice(p.price * line.quantity)}</span>
        </div>
      </div>
      <div className="flex flex-col justify-between">
        <button aria-label="حذف" onClick={() => removeFromCart(line.key)} className="text-mist/50 hover:text-red-400"><Trash2 size={16} /></button>
        <button aria-label="علاقه‌مندی" onClick={() => toggleWishlist(p.id)}><Heart size={16} className={wishlist.includes(p.id) ? 'fill-magenta text-magenta' : 'text-mist/50'} /></button>
      </div>
    </div>
  );
}
