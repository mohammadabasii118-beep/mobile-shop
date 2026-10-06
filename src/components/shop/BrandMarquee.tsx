import Link from 'next/link';

/** نوار بی‌پایان برندها؛ با hover یا لمس می‌ایستد (CSS). نسخه‌ی دوم برای خوانندهٔ صفحه پنهان است. */
export default function BrandMarquee({ brands }: { brands: { slug: string; name: string }[] }) {
  if (!brands.length) return null;
  const base = Array.from({ length: Math.max(1, Math.ceil(10 / brands.length)) }, () => brands).flat();
  return (
    <section className="sec railsec tight-top">
      <div className="wrap">
        <div className="sh"><div><h2>برندهای معتبر</h2></div></div>
      </div>
      <div className="marquee" aria-label="برندها">
        <div className="mq">
          {[0, 1].map((copy) => base.map((b, i) => (
            <Link key={`${copy}-${i}`} className="bpill" href={`/shop?brand=${b.slug}`} {...(copy ? { 'aria-hidden': true, tabIndex: -1 } : {})}>{b.name}</Link>
          )))}
        </div>
      </div>
    </section>
  );
}
