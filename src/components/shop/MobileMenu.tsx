'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, Menu, Moon, Phone, Store, Tag, User, X } from 'lucide-react';
import type { Category } from '@/lib/catalog';
import Pic from './Pic';
import { toggleTheme } from './HeaderActions';

export default function MobileMenu({ categories, storeName, phone }: { categories: Category[]; storeName: string; phone: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const btn = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
      btn.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button ref={btn} className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="باز کردن منو" aria-expanded={open}>
        <Menu className="i" />
      </button>
      {open && (
        <>
          <div className="drawer-bg" onClick={() => setOpen(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="منوی سایت">
            <header>
              <b style={{ fontSize: 20 }}>{storeName}</b>
              <button ref={closeBtn} className="icon-btn" onClick={() => setOpen(false)} aria-label="بستن منو"><X className="i" /></button>
            </header>
            <nav>
              <Link href="/shop"><Store className="i" /> همه‌ی محصولات</Link>
              <Link href="/shop?sale=1"><Tag className="i" /> تخفیف‌ها</Link>
              <h4>دسته‌بندی‌ها</h4>
              {categories.map((c) => (
                <Link key={c.id} href={`/category/${c.slug}`}>
                  {c.art ? <Pic src={`art:${c.art}`} className="art" /> : null}
                  {c.name}
                </Link>
              ))}
              <h4>حساب من</h4>
              <Link href="/account"><User className="i" /> حساب کاربری و سفارش‌ها</Link>
              <Link href="/wishlist"><Heart className="i" /> علاقه‌مندی‌ها</Link>
              <button className="icon-btn" style={{ width: '100%', borderRadius: 10, justifyContent: 'flex-start', gap: 12, padding: '12px', height: 'auto', fontWeight: 600 }} onClick={toggleTheme}>
                <Moon className="i" /> تغییر تم روشن و تیره
              </button>
              <h4>پشتیبانی</h4>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, color: 'var(--mute)' }}><Phone className="i" /> <span className="num">{phone}</span></span>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
