import type { Metadata } from 'next';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { all } from '@/lib/db';
import { fa, jdatetime } from '@/lib/format';
import { Card, EmptyState, PageHead, Pill, one } from '@/components/admin/ui';
import { ConfirmForm, QuickAction } from '@/components/admin/client';
import { moderateReview } from '@/lib/actions/admin-sales';

export const metadata: Metadata = { title: 'نظرات' };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = one((await searchParams).filter);
  const rows = all<{ id: number; product_id: number | null; product: string | null; author: string; rating: number; body: string; approved: number; show_home: number; created_at: string }>(
    `SELECT r.*, p.name product FROM reviews r LEFT JOIN products p ON p.id = r.product_id ${f === 'pending' ? 'WHERE r.approved = 0' : f === 'approved' ? 'WHERE r.approved = 1' : ''} ORDER BY r.approved ASC, r.id DESC LIMIT 100`);
  const pending = all<{ n: number }>('SELECT COUNT(*) n FROM reviews WHERE approved = 0')[0].n;
  return (
    <>
      <PageHead title="نظرات مشتریان" desc="نظرهای ثبت‌شده در صفحه‌ی محصولات. تا تأیید نشوند در سایت نمایش داده نمی‌شوند. می‌توانید نظرهای خوب را در صفحه‌ی اصلی هم نمایش دهید." />
      <Card tight>
        <nav className="ad-tabs"><Link href="/admin/reviews" aria-current={!f ? 'page' : undefined}>همه</Link><Link href="/admin/reviews?filter=pending" aria-current={f === 'pending' ? 'page' : undefined}>منتظر تأیید <span className="c num">{fa(pending)}</span></Link><Link href="/admin/reviews?filter=approved" aria-current={f === 'approved' ? 'page' : undefined}>تأییدشده</Link></nav>
        {rows.length === 0 ? <EmptyState title="نظری وجود ندارد" /> : rows.map((r) => (
          <div className="list-rows row" key={r.id} style={{ display: 'grid', gap: 8, alignItems: 'start' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <b style={{ color: 'var(--ink)' }}>{r.author}</b>
              <span className="stars" role="img" aria-label={`${fa(r.rating)} ستاره`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={n > r.rating ? 'off' : ''} />)}</span>
              <Pill tone={r.approved ? 'success' : 'warning'}>{r.approved ? 'تأییدشده' : 'منتظر تأیید'}</Pill>
              {r.show_home ? <Pill tone="info">صفحه اصلی</Pill> : null}
              <span className="mute" style={{ fontSize: 12 }}>{jdatetime(r.created_at)}</span>
            </div>
            <p style={{ color: 'var(--ink)' }}>{r.body}</p>
            {r.product && <small className="mute">برای: <Link className="link" href={`/admin/products/${r.product_id}`}>{r.product}</Link></small>}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {!r.approved ? <QuickAction action={moderateReview.bind(null, r.id, 'approve')} className="btn btn-primary btn-sm">تأیید</QuickAction> : <QuickAction action={moderateReview.bind(null, r.id, 'unapprove')} className="btn btn-secondary btn-sm">لغو تأیید</QuickAction>}
              {r.show_home ? <QuickAction action={moderateReview.bind(null, r.id, 'unhome')} className="btn btn-secondary btn-sm">حذف از صفحه اصلی</QuickAction> : <QuickAction action={moderateReview.bind(null, r.id, 'home')} className="btn btn-secondary btn-sm">نمایش در صفحه اصلی</QuickAction>}
              <ConfirmForm action={moderateReview.bind(null, r.id, 'delete')} label="حذف" message="حذف شود؟" />
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
