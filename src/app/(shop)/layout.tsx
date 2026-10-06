import CartProvider from '@/components/shop/CartProvider';
import Header from '@/components/shop/Header';
import Footer from '@/components/shop/Footer';
import BottomNav from '@/components/shop/BottomNav';
import { getCategories, getSettings } from '@/lib/catalog';
import { getUser } from '@/lib/auth';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const settings = getSettings();
  const categories = getCategories();
  const user = await getUser();
  return (
    <CartProvider>
      <div className="app">
        <a className="skip" href="#main">پرش به محتوا</a>
        <Header settings={settings} categories={categories} userName={user?.name ?? null} />
        <main id="main">{children}</main>
        <Footer settings={settings} categories={categories} />
        <BottomNav />
      </div>
    </CartProvider>
  );
}
