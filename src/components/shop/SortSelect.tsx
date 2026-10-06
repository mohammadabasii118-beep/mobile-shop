'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  return (
    <>
      <label className="sr" htmlFor="sort">مرتب‌سازی</label>
      <select
        id="sort" className="select" value={value}
        onChange={(e) => {
          const p = new URLSearchParams(sp.toString());
          p.set('sort', e.target.value);
          p.delete('page');
          router.push(`${path}?${p.toString()}`);
        }}
      >
        <option value="new">جدیدترین</option>
        <option value="popular">محبوب‌ترین</option>
        <option value="price_asc">ارزان‌ترین</option>
        <option value="price_desc">گران‌ترین</option>
      </select>
    </>
  );
}
