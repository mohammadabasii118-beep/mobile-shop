import type { Metadata } from 'next';
import CartView from '@/components/shop/CartView';
import { Crumbs } from '@/components/shop/Listing';

export const metadata: Metadata = { title: 'سبد خرید', robots: { index: false } };

export default function CartPage() {
  return (
    <>
      <Crumbs items={[{ label: 'سبد خرید' }]} />
      <div className="wrap"><div className="page-head"><h1>سبد خرید</h1></div><CartView /></div>
    </>
  );
}
