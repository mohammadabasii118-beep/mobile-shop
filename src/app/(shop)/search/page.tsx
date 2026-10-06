import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import Listing, { Crumbs, paramsOf, type SP } from '@/components/shop/Listing';
import { getCategories } from '@/lib/catalog';

export const metadata: Metadata = { title: 'جستجو', robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { q } = paramsOf(sp);
  const cats = getCategories().filter((c) => !c.parent_id);
  return (
    <>
      <Crumbs items={[{ label: 'جستجو' }]} />
      <div className="wrap page-head"><h1>{q ? <>نتایج جستجو برای «{q}»</> : 'جستجو'}</h1></div>
      {q ? (
        <Listing basePath="/search" sp={sp} forceQ={q} emptyHint="املای عبارت را بررسی کنید یا از دسته‌بندی‌ها استفاده کنید." />
      ) : (
        <div className="wrap" style={{ paddingBottom: 64 }}>
          <div className="empty"><Search className="big" /><h2>دنبال چه چیزی می‌گردید؟</h2><p>نام محصول، برند یا دسته را در کادر جستجو بنویسید.</p></div>
          <div className="chips" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            {cats.map((c) => <Link key={c.id} className="chip" href={`/category/${c.slug}`}>{c.name}</Link>)}
          </div>
        </div>
      )}
    </>
  );
}
