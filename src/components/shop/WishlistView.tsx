'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { getWishlistItems } from '@/lib/actions/shop';
import type { CardData } from '@/lib/types';
import ProductGrid from './ProductGrid';
import { ProductSkeleton } from './ProductCard';
import { useShop } from './CartProvider';

export default function WishlistView() {
  const { wish, ready } = useShop();
  const [items, setItems] = useState<CardData[] | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (wish.length === 0) { setItems([]); return; }
    getWishlistItems(wish).then(setItems);
  }, [wish, ready]);
  if (items === null) return <div className="grid g4">{Array.from({ length: 4 }, (_, i) => <ProductSkeleton key={i} />)}</div>;
  if (items.length === 0) return (
    <div className="empty"><Heart className="big" /><h2>فهرست علاقه‌مندی‌ها خالی است</h2><p>با زدن آیکن قلب روی هر محصول، آن را اینجا ذخیره کنید.</p><Link className="btn btn-primary btn-lg" href="/shop">مشاهده‌ی فروشگاه</Link></div>
  );
  return <ProductGrid items={items.filter((p) => wish.includes(p.id))} />;
}
