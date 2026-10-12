import type { Metadata } from 'next';
import Link from 'next/link';
import { Crumbs } from '@/components/shop/Listing';
import ChannelCard from '@/components/shop/ChannelCard';
import { getSettings } from '@/lib/catalog';
import { countChannelPosts, getChannelPosts } from '@/lib/channel/feed';
import { fa } from '@/lib/format';

export const metadata: Metadata = { title: 'تازه‌های کانال' };
const PER = 12;

export default async function ChannelPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const total = countChannelPosts();
  const pages = Math.max(1, Math.ceil(total / PER));
  const page = Math.min(pages, Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1));
  const posts = getChannelPosts(PER, (page - 1) * PER);
  const s = getSettings();
  return (
    <>
      <Crumbs items={[{ label: 'تازه‌های کانال' }]} />
      <div className="wrap" style={{ paddingBottom: 64 }}>
        <div className="page-head"><h1>تازه‌های کانال</h1><p>آخرین پست‌های کانال تلگرام {s.store_name}</p></div>
        {posts.length === 0 ? (
          <div className="empty"><h2>هنوز پستی منتشر نشده</h2><p>به‌محض انتشار پست در کانال، اینجا دیده می‌شود.</p></div>
        ) : (
          <div className="chan-grid">{posts.map((p) => <ChannelCard key={p.id} p={p} channelUrl={s.telegram || undefined} />)}</div>
        )}
        {pages > 1 && (
          <nav className="pager" aria-label="صفحه‌بندی" style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 28 }}>
            {page > 1 && <Link className="btn btn-secondary" href={`/channel?page=${page - 1}`}>قبلی</Link>}
            <span className="mute num" style={{ alignSelf: 'center' }}>صفحه {fa(page)} از {fa(pages)}</span>
            {page < pages && <Link className="btn btn-secondary" href={`/channel?page=${page + 1}`}>بعدی</Link>}
          </nav>
        )}
      </div>
    </>
  );
}
