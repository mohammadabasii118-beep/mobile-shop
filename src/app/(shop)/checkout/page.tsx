import type { Metadata } from 'next';
import CheckoutForm from '@/components/shop/CheckoutForm';
import { Crumbs } from '@/components/shop/Listing';
import { getSettings } from '@/lib/catalog';
import { getUser } from '@/lib/auth';
import { onlineGatewayEnabled } from '@/lib/payments';

export const metadata: Metadata = { title: 'تسویه حساب', robots: { index: false } };

export default async function CheckoutPage() {
  const s = getSettings();
  const u = await getUser();
  return (
    <>
      <Crumbs items={[{ label: 'سبد خرید', href: '/cart' }, { label: 'تسویه حساب' }]} />
      <div className="wrap">
        <div className="page-head"><h1>تسویه حساب</h1></div>
        <CheckoutForm defaults={{ name: u?.name ?? '', phone: u && /^09\d{9}$/.test(u.login) ? u.login : '' }} payCod={s.pay_cod === '1'} payOnline={s.pay_online === '1' && onlineGatewayEnabled()} note={s.checkout_note} />
      </div>
    </>
  );
}
