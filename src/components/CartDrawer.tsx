import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useShop } from '@/store';
import { Sheet } from './Sheet';
import { CartItem } from './CartItem';
import { FreeShippingBar, TotalsTable, useCartTotals } from './CartSummary';

export function CartDrawer() {
  const open = useShop((s) => s.cartOpen);
  const setOpen = useShop((s) => s.setCartOpen);
  const cart = useShop((s) => s.cart);
  const t = useCartTotals();
  const nav = useNavigate();
  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="سبد خرید" side="left">
      {cart.length === 0 ? (
        <div className="grid h-full place-items-center p-8 text-center">
          <div><ShoppingBag size={48} className="mx-auto mb-4 text-mist/30" /><p className="mb-4 font-bold text-white">سبد خرید شما خالی است</p>
            <Link to="/shop" onClick={() => setOpen(false)} className="btn btn-primary">مشاهده فروشگاه</Link></div>
        </div>
      ) : (
        <div className="flex min-h-full flex-col">
          <div className="flex-1 space-y-3 p-4"><FreeShippingBar payable={t.payable} />{cart.map((l) => <CartItem key={l.key} line={l} compact />)}</div>
          <div className="sticky bottom-0 space-y-4 border-t border-line bg-surface p-5">
            <TotalsTable t={t} />
            <button className="btn btn-primary w-full" onClick={() => { setOpen(false); nav('/checkout'); }}>ادامه فرآیند خرید</button>
            <Link to="/cart" onClick={() => setOpen(false)} className="block text-center text-xs font-bold text-mist/70 hover:text-white">مشاهده صفحه سبد خرید</Link>
          </div>
        </div>
      )}
    </Sheet>
  );
}
