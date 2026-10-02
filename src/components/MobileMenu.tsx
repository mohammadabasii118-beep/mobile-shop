import { Link } from 'react-router-dom';
import { useShop } from '@/store';
import { Sheet } from './Sheet';
import { navLinks } from './Navbar';

export function MobileMenu() {
  const { menuOpen, setMenuOpen } = useShop();
  const close = () => setMenuOpen(false);
  return (
    <Sheet open={menuOpen} onClose={close} title="منو" side="right">
      <nav className="flex flex-col p-4">
        {[...navLinks, { to: '/account', label: 'حساب کاربری' }, { to: '/account/wishlist', label: 'علاقه‌مندی‌ها' }, { to: '/faq', label: 'سوالات متداول' }, { to: '/contact', label: 'تماس با ما' }].map((l) => (
          <Link key={l.label} to={l.to} onClick={close} className="border-b border-line py-4 text-lg font-bold text-white">{l.label}</Link>
        ))}
      </nav>
    </Sheet>
  );
}
