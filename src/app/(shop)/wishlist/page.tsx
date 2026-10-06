import type { Metadata } from 'next';
import WishlistView from '@/components/shop/WishlistView';
import { Crumbs } from '@/components/shop/Listing';

export const metadata: Metadata = { title: 'علاقه‌مندی‌ها', robots: { index: false } };

export default function WishlistPage() {
  return (
    <>
      <Crumbs items={[{ label: 'علاقه‌مندی‌ها' }]} />
      <div className="wrap" style={{ paddingBottom: 64 }}><div className="page-head"><h1>علاقه‌مندی‌ها</h1></div><WishlistView /></div>
    </>
  );
}
