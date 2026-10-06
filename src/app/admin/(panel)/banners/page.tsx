import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react';
import { all } from '@/lib/db';
import { jdate } from '@/lib/format';
import type { Banner } from '@/lib/types';
import { Card, EmptyState, Note, PageHead, Pill } from '@/components/admin/ui';
import { ConfirmForm, QuickAction } from '@/components/admin/client';
import { deleteBanner, moveBanner, toggleBanner } from '@/lib/actions/admin-content';
import Pic from '@/components/shop/Pic';

export const metadata: Metadata = { title: 'بنرها و اسلایدر' };

function Section({ title, desc, rows, position }: { title: string; desc: string; rows: Banner[]; position: string }) {
  return (
    <Card title={title} desc={desc} actions={<Link className="btn btn-primary btn-sm" href={`/admin/banners/new?position=${position}`}><Plus />بنر جدید</Link>} tight>
      {rows.length === 0 ? <EmptyState title="بنری ثبت نشده" /> : rows.map((b, i) => {
        const now = new Date().toISOString().slice(0, 10);
        const expired = b.ends_at && b.ends_at.slice(0, 10) < now, future = b.starts_at && b.starts_at.slice(0, 10) > now;
        return (
          <div className="list-rows row" key={b.id} style={{ display: 'flex', flexWrap: 'wrap' }}>
            <span className="ad-table"><span className="thumb" style={{ width: 84, height: 56, borderRadius: 10, background: b.theme === 'night' ? 'var(--night)' : b.theme === 'brand' ? 'var(--action)' : 'var(--studio)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
              {b.layout === 'cover' && b.image ? <Pic src={b.image} className="" /> : <Pic src={b.image || (b.art ? `art:${b.art}` : null)} />}
            </span></span>
            <span className="t" style={{ minWidth: 180 }}>
              <b style={{ whiteSpace: 'normal' }}>{b.title.replace(/\*/g, '').replace(/\n/g, ' ')}</b>
              <small>{b.layout === 'cover' ? 'تمام‌تصویر' : 'متن + محصول'} · {b.cta_text || 'بدون دکمه'} {b.link && <span dir="ltr">→ {b.link}</span>}{(b.starts_at || b.ends_at) && ` · ${b.starts_at ? jdate(b.starts_at) : '…'} تا ${b.ends_at ? jdate(b.ends_at) : '…'}`}</small>
            </span>
            <Pill tone={!b.active ? 'muted' : expired ? 'danger' : future ? 'warning' : 'success'}>{!b.active ? 'غیرفعال' : expired ? 'منقضی' : future ? 'زمان‌بندی‌شده' : 'در حال نمایش'}</Pill>
            <span style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              <QuickAction action={moveBanner.bind(null, b.id, -1)} className="icon-btn" title="بالاتر"><ArrowUp className="i" style={{ width: 17 }} /></QuickAction>
              <QuickAction action={moveBanner.bind(null, b.id, 1)} className="icon-btn" title="پایین‌تر"><ArrowDown className="i" style={{ width: 17 }} /></QuickAction>
              <QuickAction action={toggleBanner.bind(null, b.id)} className="btn btn-secondary btn-sm">{b.active ? 'غیرفعال' : 'فعال'}</QuickAction>
              <Link className="btn btn-secondary btn-sm" href={`/admin/banners/${b.id}`}><Pencil />ویرایش</Link>
              <ConfirmForm action={deleteBanner.bind(null, b.id)} label="حذف" message="حذف شود؟" />
            </span>
            <span hidden>{i}</span>
          </div>
        );
      })}
    </Card>
  );
}

export default function BannersPage() {
  const rows = all<Banner>('SELECT * FROM banners ORDER BY sort, id');
  return (
    <>
      <PageHead title="بنرها و اسلایدر" desc="بنرهای اسلایدر بالای صفحه‌ی اصلی به‌صورت کشویی پخش می‌شوند و بنرهای تبلیغاتی میانی کنار هم نمایش داده می‌شوند. ترتیب با فلش‌ها عوض می‌شود." />
      <div className="ad-stack">
        <Section title="اسلایدر صفحه‌ی اصلی" desc="هر چند بنر که فعال باشد، پشت‌سرهم و با تأخیر ۶٫۵ ثانیه پخش می‌شود. ۳ تا ۵ بنر مناسب است." rows={rows.filter((b) => b.position === 'hero')} position="hero" />
        <Section title="بنرهای تبلیغاتی (میانه‌ی صفحه)" desc="دو بنر اول فعال نمایش داده می‌شود." rows={rows.filter((b) => b.position === 'promo')} position="promo" />
        <Note>اگر هیچ بنر فعالی در اسلایدر نباشد، یک بنر پیش‌فرض نمایش داده می‌شود.</Note>
      </div>
    </>
  );
}
