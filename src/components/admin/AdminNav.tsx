'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3, Boxes, CreditCard, FolderTree, GalleryHorizontal, LayoutDashboard, Menu, MessageSquare, Package, Percent, Search, Settings, ShoppingCart,
  SlidersHorizontal, Store, Tag, Ticket, Users, BadgeCheck, LogOut, Plus,
} from 'lucide-react';
import CommandPalette from './CommandPalette';
import { AdminToaster } from './client';

const ICONS = { dashboard: LayoutDashboard, orders: ShoppingCart, payments: CreditCard, coupons: Ticket, discounts: Percent, products: Package, attributes: SlidersHorizontal, categories: FolderTree, brands: BadgeCheck, inventory: Boxes, reviews: MessageSquare, users: Users, banners: GalleryHorizontal, reports: BarChart3, settings: Settings, plus: Plus, tag: Tag };
export type IconKey = keyof typeof ICONS;
export type NavGroup = { title: string; items: { href: string; label: string; icon: IconKey; badge?: number; warn?: boolean; keywords?: string }[] };

export default function AdminNav({ groups, storeName, userName, logout, children }: { groups: NavGroup[]; storeName: string; userName: string; logout: () => Promise<void>; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [cmd, setCmd] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd(true); }
      else if (e.key === '/' && !/input|textarea|select/i.test((document.activeElement as HTMLElement)?.tagName || '') && !(document.activeElement as HTMLElement)?.isContentEditable) { e.preventDefault(); setCmd(true); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const active = (href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(href + '/'));

  return (
    <div className="ad-shell">
      {open && <div className="ad-scrim" onClick={() => setOpen(false)} />}
      <aside className={`ad-side${open ? ' open' : ''}`} aria-label="منوی مدیریت">
        <div className="ad-brand"><i /><div>{storeName}<small>پنل مدیریت</small></div></div>
        {groups.map((g) => (
          <nav key={g.title} className="ad-group" aria-label={g.title}>
            <h4>{g.title}</h4>
            {g.items.map((it) => {
              const Icon = ICONS[it.icon];
              return (
                <Link key={it.href} className="ad-link" href={it.href} aria-current={active(it.href) ? 'page' : undefined}>
                  <Icon aria-hidden />{it.label}
                  {!!it.badge && <span className={`n num${it.warn ? '' : ' mute'}`}>{it.badge.toLocaleString('fa-IR')}</span>}
                </Link>
              );
            })}
          </nav>
        ))}
        <div className="foot-links">
          <Link className="ad-link" href="/" target="_blank"><Store aria-hidden />مشاهده‌ی سایت</Link>
          <form action={logout}><button className="ad-link" style={{ width: '100%' }} type="submit"><LogOut aria-hidden />خروج</button></form>
        </div>
      </aside>
      <div className="ad-main">
        <header className="ad-top">
          <button className="icon-btn menu" onClick={() => setOpen(true)} aria-label="باز کردن منو"><Menu className="i" /></button>
          <button className="ad-cmd" onClick={() => setCmd(true)} aria-label="جستجو و پرش سریع">
            <Search className="i" style={{ width: 18, height: 18 }} /><span className="full">جستجو: سفارش، محصول، صفحه…</span><span className="short">جستجو…</span><kbd>Ctrl K</kbd>
          </button>
          <span className="sp" />
          <span className="ad-user" title={userName}><span className="nm">{userName}</span><span className="av">{userName.slice(0, 1)}</span></span>
        </header>
        <div className="ad-content" id="admin-main">{children}</div>
      </div>
      {cmd && <CommandPalette groups={groups} onClose={() => setCmd(false)} />}
      <AdminToaster />
    </div>
  );
}
