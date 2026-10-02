import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Menu, Search, ShoppingBag, User } from 'lucide-react';
import { useShop } from '@/store';
import { toFa } from '@/utils/format';

const links = [
  { to: '/', label: 'خانه' },
  { to: '/shop', label: 'فروشگاه' },
  { to: '/category/cases', label: 'قاب گوشی' },
  { to: '/category/accessories', label: 'لوازم جانبی' },
  { to: '/shop?sort=new', label: 'محصولات جدید' },
  { to: '/shop?sort=popular', label: 'پرفروش‌ها' },
];

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 text-xl font-black tracking-tight text-white ${className}`} aria-label="CaseLine">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-gradient"><span className="h-4 w-2.5 rounded-[4px] border-2 border-white" /></span>
      <span dir="ltr">Case<span className="text-gradient">Line</span></span>
    </Link>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { cart, wishlist, user, setCartOpen, setSearchOpen, setMenuOpen, cartPulse } = useShop();
  const count = cart.reduce((s, l) => s + l.quantity, 0);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const icon = 'relative grid h-10 w-10 place-items-center rounded-full text-white transition hover:bg-white/10';
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${scrolled ? 'border-b border-line bg-ink/75 backdrop-blur-xl' : 'bg-transparent'}`}>
      <div className={`container-x flex items-center justify-between transition-all duration-500 ${scrolled ? 'h-16' : 'h-20'}`}>
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="منوی اصلی">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => `rounded-full px-4 py-2 text-sm font-semibold transition ${isActive && !l.to.includes('?') ? 'bg-white/10 text-white' : 'text-mist/70 hover:text-white'}`}>{l.label}</NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <button className={icon} aria-label="جستجو" onClick={() => setSearchOpen(true)}><Search size={20} /></button>
          <Link to={user.loggedIn ? '/account' : '/account'} className={`${icon} hidden sm:grid`} aria-label="حساب کاربری"><User size={20} /></Link>
          <Link to="/account/wishlist" className={`${icon} hidden sm:grid`} aria-label="علاقه‌مندی‌ها">
            <Heart size={20} />{wishlist.length > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-magenta px-1 text-[10px] font-bold">{toFa(wishlist.length)}</span>}
          </Link>
          <button id="cart-icon" className={icon} aria-label="سبد خرید" onClick={() => setCartOpen(true)}>
            <motion.span key={cartPulse} animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.4 }}><ShoppingBag size={20} /></motion.span>
            {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-violet px-1 text-[10px] font-bold">{toFa(count)}</span>}
          </button>
          <button className={`${icon} lg:hidden`} aria-label="منو" onClick={() => setMenuOpen(true)}><Menu size={22} /></button>
        </div>
      </div>
    </header>
  );
}

export { links as navLinks };
