'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Search, ShoppingBag, User } from 'lucide-react';
import { CountBadge, useShop } from './CartProvider';

export default function BottomNav() {
  const path = usePathname();
  const { count } = useShop();
  const items = [
    { href: '/', label: 'خانه', Icon: Home, match: (p: string) => p === '/' },
    { href: '/shop', label: 'دسته‌ها', Icon: LayoutGrid, match: (p: string) => p.startsWith('/shop') || p.startsWith('/category') || p.startsWith('/product') },
    { href: '/search', label: 'جستجو', Icon: Search, match: (p: string) => p.startsWith('/search') },
    { href: '/cart', label: 'سبد', Icon: ShoppingBag, match: (p: string) => p.startsWith('/cart') || p.startsWith('/checkout') },
    { href: '/account', label: 'حساب', Icon: User, match: (p: string) => p.startsWith('/account') || p.startsWith('/wishlist') },
  ];
  return (
    <nav className="bn" aria-label="ناوبری موبایل">
      {items.map(({ href, label, Icon, match }) => (
        <Link key={href} href={href} aria-current={match(path) ? 'page' : undefined}>
          <Icon className="i" />
          {label}
          {href === '/cart' && <CountBadge n={count} />}
        </Link>
      ))}
    </nav>
  );
}
