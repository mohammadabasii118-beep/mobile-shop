'use client';

import Link from 'next/link';
import { BellRing, Heart, Plus, SlidersHorizontal, Star } from 'lucide-react';
import type { CardData } from '@/lib/types';
import { fa, pct, toman } from '@/lib/format';
import Pic from './Pic';
import { useShop } from './CartProvider';

const BADGES = { new: ['جدید', 'b-new'], best: ['پرفروش', 'b-best'], promo: ['تخفیف ویژه', 'b-promo'] } as const;

export default function ProductCard({ p, low = 5 }: { p: CardData; low?: number }) {
  const { wish, toggleWish, add, toast } = useShop();
  const sold = p.stock <= 0;
  const lowStock = !sold && p.stock <= low;
  const badge = p.badge ? BADGES[p.badge] : null;
  const href = `/product/${encodeURIComponent(p.slug)}`;
  const wished = wish.includes(p.id);

  return (
    <article className={`card${sold ? ' sold' : ''}`}>
      <div className="media">
        {badge && <span className={`badge ${badge[1]}`}>{badge[0]}</span>}
        <button className="wish" aria-pressed={wished} aria-label={wished ? `حذف «${p.name}» از علاقه‌مندی‌ها` : `افزودن «${p.name}» به علاقه‌مندی‌ها`} onClick={() => toggleWish(p.id)}>
          <Heart />
        </button>
        <Pic src={p.image} alt={p.name} />
        {sold ? (
          <button className="quick" data-soldout onClick={() => toast('وقتی موجود شد خبرتان می‌کنیم')} aria-label={`ناموجود، خبرم کن: ${p.name}`}>
            <span>خبرم کن</span><BellRing className="i" />
          </button>
        ) : p.variable ? (
          <Link className="quick" href={href} aria-label={`انتخاب گزینه‌ها: ${p.name}`}>
            <span>انتخاب گزینه‌ها</span><SlidersHorizontal className="i" />
          </Link>
        ) : (
          <button className="quick" onClick={() => add({ productId: p.id, variationId: null, qty: 1 })} aria-label={`افزودن «${p.name}» به سبد خرید`}>
            <span>افزودن به سبد</span><Plus className="i" />
          </button>
        )}
      </div>
      <div className="meta">
        {p.brand && <span className="brand">{p.brand}</span>}
        <h3 className="name"><Link href={href}>{p.name}</Link></h3>
        {p.ratingCount > 0 && (
          <div className="rate">
            <Star aria-hidden /><b className="num">{fa(Math.round(p.rating * 10) / 10)}</b>
            <span className="num">({fa(p.ratingCount)})</span>
          </div>
        )}
        {p.colors.length > 0 && (
          <div className="sw" aria-label={`${fa(p.colors.length)} رنگ`}>
            {p.colors.slice(0, 4).map((c, i) => <i key={i} style={{ background: c }} />)}
            {p.colors.length > 4 && <small className="num">+{fa(p.colors.length - 4)}</small>}
          </div>
        )}
        <div className={`price${p.off ? ' off' : ''}`}>
          {p.variable && <span className="from">از</span>}
          <span className="now num">{toman(p.price)} <span className="unit">تومان</span></span>
          {p.old ? (
            <>
              <s className="num"><span className="sr">قیمت قبل از تخفیف: </span>{toman(p.old)}</s>
              <span className="pct">−{pct(p.off)}</span>
            </>
          ) : null}
        </div>
        <span className={`stock${sold ? ' out' : lowStock ? ' low' : ''}`}>{sold ? 'ناموجود' : lowStock ? `تنها ${fa(p.stock)} عدد` : 'موجود در انبار'}</span>
      </div>
    </article>
  );
}

export function ProductSkeleton() {
  return (
    <article className="card" aria-hidden>
      <div className="media sk" />
      <div className="meta">
        <span className="sk" style={{ width: '36%', height: 12 }} />
        <span className="sk" style={{ width: '90%', height: 16 }} />
        <span className="sk" style={{ width: '60%', height: 16 }} />
        <span className="sk" style={{ width: '46%', height: 20, marginTop: 4 }} />
      </div>
    </article>
  );
}
