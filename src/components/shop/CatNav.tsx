'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Category } from '@/lib/catalog';

export default function CatNav({ categories }: { categories: Category[] }) {
  const path = decodeURIComponent(usePathname());
  return (
    <div className="wrap">
      <nav className="cats" aria-label="دسته‌بندی‌ها">
        <Link href="/shop" aria-current={path === '/shop' ? 'page' : undefined}>همه‌ی محصولات</Link>
        {categories.map((c) => (
          <Link key={c.id} href={`/category/${c.slug}`} aria-current={path === `/category/${c.slug}` ? 'page' : undefined}>{c.name}</Link>
        ))}
        <Link href="/shop?sale=1">تخفیف‌ها</Link>
      </nav>
    </div>
  );
}
