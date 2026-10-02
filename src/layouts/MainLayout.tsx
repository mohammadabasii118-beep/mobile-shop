import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { MobileMenu } from '@/components/MobileMenu';
import { SearchOverlay } from '@/components/SearchOverlay';
import { CartDrawer } from '@/components/CartDrawer';
import { QuickView } from '@/components/QuickView';
import { useShop } from '@/store';

export default function MainLayout() {
  const { pathname } = useLocation();
  const { setCartOpen, setMenuOpen, setSearchOpen, setQuickView } = useShop();
  useEffect(() => { window.scrollTo({ top: 0 }); setCartOpen(false); setMenuOpen(false); setSearchOpen(false); setQuickView(null); }, [pathname]);
  return (
    <>
      <Navbar />
      <main className="min-h-screen"><Outlet /></main>
      <Footer />
      <MobileMenu /><SearchOverlay /><CartDrawer /><QuickView />
    </>
  );
}
