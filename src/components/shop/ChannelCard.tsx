import Link from 'next/link';
import Pic from './Pic';
import { jdate } from '@/lib/format';
import { excerpt, type ChannelPost } from '@/lib/channel/feed';

/** کارت پست کانال. اگر از پست محصول ساخته شده باشد، به صفحه‌ی همان محصول می‌رود. */
export default function ChannelCard({ p, channelUrl }: { p: ChannelPost; channelUrl?: string }) {
  const href = p.product_slug ? `/product/${p.product_slug}` : null;
  const body = (
    <>
      {p.image && <div className="media"><Pic src={p.image} alt="" className="art" sizes="(max-width: 640px) 70vw, 300px" /></div>}
      <div className="body">
        <time className="mute" dateTime={p.posted_at}>{jdate(p.posted_at)}</time>
        <p>{excerpt(p.text)}</p>
        {href ? <span className="more">مشاهده‌ی محصول</span> : null}
      </div>
    </>
  );
  return (
    <article className="chan-card">
      {href ? <Link href={href} className="chan-link">{body}</Link> : <div className="chan-link">{body}</div>}
      {!href && channelUrl && <a className="more" href={channelUrl} rel="noopener noreferrer" target="_blank">ادامه در کانال</a>}
    </article>
  );
}
