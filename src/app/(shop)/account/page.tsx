import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LogOut, Package, User } from 'lucide-react';
import { getUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { fa, jdatetime, ORDER_STATUS, PAY_STATUS, toman } from '@/lib/format';
import { logout } from '@/lib/actions/shop';
import ProfileForm from '@/components/shop/ProfileForm';
import { Crumbs } from '@/components/shop/Listing';
import Link from 'next/link';

export const metadata: Metadata = { title: 'حساب کاربری', robots: { index: false } };

type O = { id: number; number: string; status: string; payment_status: string; total: number; created_at: string };

export default async function AccountPage() {
  const user = await getUser();
  if (!user) redirect('/account/login');
  const orders = all<O>('SELECT id, number, status, payment_status, total, created_at FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50', user.id);
  const items = all<{ order_id: number; name: string; variation_label: string; qty: number }>(
    `SELECT order_id, name, variation_label, qty FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?)`, user.id);
  return (
    <>
      <Crumbs items={[{ label: 'حساب کاربری' }]} />
      <div className="wrap">
        <div className="page-head"><h1>سلام {user.name || 'دوست عزیز'}</h1><p>مدیریت سفارش‌ها و اطلاعات حساب</p></div>
        <div className="acc-grid">
          <nav className="acc-nav" aria-label="منوی حساب">
            <a href="#orders" aria-current="page"><Package className="i" />سفارش‌های من</a>
            <a href="#profile"><User className="i" />اطلاعات حساب</a>
            {user.role === 'admin' && <Link href="/admin">پنل مدیریت</Link>}
            <form action={logout}><button type="submit" style={{ width: '100%' }}><LogOut className="i" />خروج</button></form>
          </nav>
          <div style={{ display: 'grid', gap: 32, minWidth: 0 }}>
            <section id="orders">
              <h2 style={{ fontSize: 20, marginBottom: 14 }}>سفارش‌های من</h2>
              {orders.length === 0 ? (
                <div className="empty"><Package className="big" /><h3>هنوز سفارشی ثبت نکرده‌اید</h3><Link className="btn btn-primary" href="/shop">شروع خرید</Link></div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {orders.map((o) => (
                    <div key={o.id} className="order-card">
                      <div className="hd"><b>سفارش <span className="num">{fa(o.number)}</span></b><span className={`pill ${ORDER_STATUS[o.status].tone}`}>{ORDER_STATUS[o.status].label}</span></div>
                      <ul style={{ fontSize: 14, color: 'var(--body)' }}>
                        {items.filter((i) => i.order_id === o.id).map((i, k) => <li key={k}>{i.name}{i.variation_label ? ` (${i.variation_label})` : ''} × <span className="num">{fa(i.qty)}</span></li>)}
                      </ul>
                      <div className="hd" style={{ fontSize: 13, color: 'var(--mute)' }}>
                        <span>{jdatetime(o.created_at)}</span>
                        <span><span className={`pill ${PAY_STATUS[o.payment_status].tone}`}>{PAY_STATUS[o.payment_status].label}</span> <b className="num" style={{ color: 'var(--ink)', marginInlineStart: 8 }}>{toman(o.total)} تومان</b></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section id="profile">
              <h2 style={{ fontSize: 20, marginBottom: 14 }}>اطلاعات حساب</h2>
              <ProfileForm name={user.name} login={user.login} />
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
