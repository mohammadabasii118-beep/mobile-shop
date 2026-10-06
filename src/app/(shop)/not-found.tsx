import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="wrap">
      <div className="not-found">
        <b className="num">۴۰۴</b>
        <h1 style={{ fontSize: 24 }}>صفحه‌ای که دنبالش بودید پیدا نشد</h1>
        <p className="mute">ممکن است آدرس تغییر کرده یا محصول دیگر موجود نباشد.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link className="btn btn-primary btn-lg" href="/">صفحه اصلی</Link>
          <Link className="btn btn-secondary btn-lg" href="/shop">مشاهده‌ی فروشگاه</Link>
        </div>
      </div>
    </div>
  );
}
