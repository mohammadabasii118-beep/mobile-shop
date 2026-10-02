import { memo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, ShoppingBag } from 'lucide-react';
import type { Product } from '@/types';
import { categoryName } from '@/data/categories';
import { categories } from '@/data/categories';
import { discountPercent, toFa } from '@/utils/format';
import { flyToCart } from '@/utils/flyToCart';
import { useShop } from '@/store';
import { ProductArt } from './ProductArt';
import { Price } from './Price';
import { Rating } from './Rating';
import { Badge } from './Badge';
import { WishlistButton } from './WishlistButton';

function ProductCardBase({ product: p, badge }: { product: Product; badge?: string }) {
  const addToCart = useShop((s) => s.addToCart);
  const setQuickView = useShop((s) => s.setQuickView);
  const off = discountPercent(p.price, p.oldPrice);
  const hue = categories.find((c) => c.slug === p.category)?.hue ?? '#8B5CF6';
  const color = p.colors[0]?.hex && p.colors[0].name !== 'شفاف' ? p.colors[0].hex : hue;
  const out = p.stock <= 0;
  return (
    <motion.article whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }} className="group card relative flex h-full flex-col overflow-hidden transition-colors hover:border-violet/40">
      <Link to={`/product/${p.slug}`} className="relative block aspect-square overflow-hidden bg-gradient-to-b from-surface2 to-surface">
        <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-110">
          <ProductArt kind={p.art} color={color} className="h-full w-full p-4" />
        </div>
        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          {off > 0 && <Badge tone="pink">{toFa(off)}٪ تخفیف</Badge>}
          {(badge || p.isBestseller) && <Badge tone="violet">{badge ?? 'پرفروش'}</Badge>}
          {p.isNew && !badge && <Badge tone="sky">جدید</Badge>}
        </div>
        {out && <div className="absolute inset-0 grid place-items-center bg-black/60 text-sm font-black text-white">ناموجود</div>}
      </Link>
      <div className="absolute left-3 top-3 flex flex-col gap-2">
        <WishlistButton id={p.id} />
        <button aria-label="مشاهده سریع" onClick={() => setQuickView(p.id)} className="grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition hover:bg-black/70 group-hover:opacity-100 max-md:opacity-100"><Eye size={17} /></button>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <span className="text-[11px] text-mist/50">{categoryName(p.category)}</span>
        <Link to={`/product/${p.slug}`} className="line-clamp-2 min-h-[2.6em] text-sm font-bold leading-snug text-white hover:text-violet">{p.name}</Link>
        <div className="flex items-center justify-between">
          <Rating value={p.rating} count={p.reviewCount} />
          {p.stock > 0 && p.stock <= 10 && <span className="text-[11px] font-bold text-amber">فقط {toFa(p.stock)} عدد</span>}
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <Price price={p.price} oldPrice={p.oldPrice} />
          <button
            disabled={out}
            aria-label="افزودن به سبد"
            onClick={(e) => { flyToCart(e.currentTarget); addToCart(p.id); }}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-ink transition hover:bg-brand-gradient hover:text-white disabled:opacity-40"
          >
            <ShoppingBag size={18} />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
export const ProductCard = memo(ProductCardBase);
