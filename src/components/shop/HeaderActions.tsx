'use client';

import Link from 'next/link';
import { Heart, Moon, ShoppingBag, User } from 'lucide-react';
import { CountBadge, useShop } from './CartProvider';

export function toggleTheme() {
  const r = document.documentElement;
  const dark = r.dataset.theme === 'dark' || (!r.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const next = dark ? 'light' : 'dark';
  r.dataset.theme = next;
  try { localStorage.setItem('vt_theme', next); } catch { /* noop */ }
}

export default function HeaderActions({ loggedIn }: { loggedIn: boolean }) {
  const { count, wish } = useShop();
  return (
    <div className="acts">
      <button className="icon-btn hide-m" onClick={toggleTheme} aria-label="تغییر تم روشن و تیره">
        <Moon className="i" />
      </button>
      <Link className="icon-btn hide-m" href="/wishlist" aria-label="علاقه‌مندی‌ها">
        <Heart className="i" />
        <CountBadge n={wish.length} />
      </Link>
      <Link className="icon-btn hide-m" href="/account" aria-label={loggedIn ? 'حساب کاربری' : 'ورود یا ثبت‌نام'}>
        <User className="i" />
      </Link>
      <Link className="icon-btn" href="/cart" aria-label="سبد خرید">
        <ShoppingBag className="i" />
        <CountBadge n={count} />
      </Link>
    </div>
  );
}
