import type { Metadata } from 'next';
import Link from 'next/link';
import { all } from '@/lib/db';
import { jdatetime } from '@/lib/format';
import { Card, EmptyState, Note, PageHead, Pill } from '@/components/admin/ui';
import { ConfirmForm, QuickAction } from '@/components/admin/client';
import { channelStatus } from '@/lib/channel/telegram';
import { deleteChannelPost, toggleChannelPost } from '@/lib/actions/admin-channel';
import { excerpt } from '@/lib/channel/feed';

export const metadata: Metadata = { title: 'کانال تلگرام' };

export default function ChannelAdminPage() {
  const st = channelStatus();
  const external = (process.env.CHANNEL_INGEST_SECRET || '').length >= 16;
  const rows = all<{ id: number; text: string; image: string | null; note: string; visible: number; posted_at: string; product_id: number | null; product_name: string | null; product_status: string | null }>(
    `SELECT c.id, c.text, c.image, c.note, c.visible, c.posted_at, c.product_id, p.name product_name, p.status product_status
       FROM channel_posts c LEFT JOIN products p ON p.id = c.product_id ORDER BY c.posted_at DESC, c.id DESC LIMIT 100`);
  return (
    <>
      <PageHead title="کانال تلگرام" desc="هر پست کانال خودکار در سایت (بخش «تازه‌های کانال») منتشر می‌شود. اگر در متن «قیمت: …» باشد، یک محصول هم ساخته می‌شود و برند گوشی، مدل‌ها و رنگ‌ها از متن خوانده و به‌عنوان متغیر تعریف می‌شوند." />
      <Card title="وضعیت اتصال">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', alignSelf: 'start' }}>
          {!st.configured && !external ? <Pill tone="warning">متصل نیست</Pill> : st.error ? <Pill tone="danger">خطا</Pill> : st.lastPollAt ? <Pill tone="success">متصل</Pill> : <Pill tone="warning">در انتظار اولین دریافت</Pill>}
          {st.configured && <span className="mute" dir="ltr">{st.channel}</span>}
          {st.lastPollAt && <span className="mute" style={{ fontSize: 12 }}>آخرین بررسی: {jdatetime(st.lastPollAt)}</span>}
          {st.lastPostAt && <span className="mute" style={{ fontSize: 12 }}>آخرین پست: {jdatetime(st.lastPostAt)}</span>}
          {external && <Pill tone="info">ورودی /api/channel/ingest فعال</Pill>}
        </div>
        {st.error && <Note warn>{st.error}</Note>}
        {!st.configured && (
          <Note>
            برای اتصال، این دو متغیر را در فایل <code dir="ltr">.env</code> سرور بگذارید و سرور را دوباره اجرا کنید: <code dir="ltr">TELEGRAM_BOT_TOKEN</code> (از @BotFather) و <code dir="ltr">TELEGRAM_CHANNEL</code> (مثل @mychannel). ربات باید ادمین کانال باشد. توکن هرگز در پنل یا سایت نمایش داده نمی‌شود.
          </Note>
        )}
        <Note>تلگرام پست‌های قبل از اتصال ربات را به ربات نمی‌دهد؛ فقط پست‌های جدید وارد می‌شوند.</Note>
      </Card>
      <Card tight title="پست‌های دریافت‌شده">
        {rows.length === 0 ? <EmptyState title="هنوز پستی دریافت نشده" desc="بعد از اتصال، یک پست در کانال بگذارید تا اینجا ظاهر شود." /> : rows.map((r) => (
          <div className="list-rows row" key={r.id} style={{ display: 'grid', gap: 8, alignItems: 'start' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', alignSelf: 'start' }}>
              <Pill tone={r.visible ? 'success' : 'muted'}>{r.visible ? 'نمایش در سایت' : 'پنهان'}</Pill>
              {r.product_id ? <Pill tone="info">محصول ساخته شد</Pill> : <Pill tone="muted">فقط فید</Pill>}
              {r.product_status === 'draft' && <Pill tone="warning">محصول پیش‌نویس</Pill>}
              <span className="mute" style={{ fontSize: 12 }}>{jdatetime(r.posted_at)}</span>
            </div>
            <p style={{ color: 'var(--ink)', whiteSpace: 'pre-line' }}>{excerpt(r.text, 300)}</p>
            <small className="mute">{r.note}</small>
            {r.product_id && <small className="mute">محصول: <Link className="link" href={`/admin/products/${r.product_id}`}>{r.product_name ?? 'مشاهده'}</Link></small>}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <QuickAction action={toggleChannelPost.bind(null, r.id)} className="btn btn-secondary btn-sm">{r.visible ? 'پنهان‌کردن' : 'نمایش'}</QuickAction>
              <ConfirmForm action={deleteChannelPost.bind(null, r.id)} label="حذف از فید" message="این پست از فید حذف شود؟ محصول ساخته‌شده حذف نمی‌شود." />
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
