import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useShop } from '@/store';
import { useSEO } from '@/utils/seo';
import { PageShell } from '@/components/PageShell';
import { CartItem } from '@/components/CartItem';
import { FreeShippingBar, TotalsTable, useCartTotals } from '@/components/CartSummary';

export default function CartPage() {
  useSEO({ title: 'سبد خرید' });
  const cart = useShop((s) => s.cart);
  const t = useCartTotals();
  return (
    <PageShell title="سبد خرید">
      {cart.length === 0 ? (
        <div className="card grid place-items-center gap-4 p-16 text-center"><ShoppingBag size={56} className="text-mist/30" /><p className="font-bold text-white">سبد خرید شما خالی است</p><Link to="/shop" className="btn btn-primary">مشاهده فروشگاه</Link></div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className="space-y-3">{cart.map((l) => <CartItem key={l.key} line={l} />)}</div>
          <aside className="card h-fit space-y-5 p-6 lg:sticky lg:top-24"><FreeShippingBar payable={t.payable} /><TotalsTable t={t} withCoupon /><Link to="/checkout" className="btn btn-primary w-full">ادامه فرآیند خرید</Link></aside>
        </div>
      )}
    </PageShell>
  );
}
