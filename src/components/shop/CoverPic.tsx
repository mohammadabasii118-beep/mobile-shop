const OPT = /^(\/uploads\/.+?)\.webp$/;
const W = [480, 960, 2400];
const set = (base: string, ext: string) => W.map((w) => `${base}${w === 2400 ? '' : `-${w}`}.${ext} ${w}w`).join(', ');

/** تصویر تمام‌عرض بنر: AVIF/WebP با srcset، منبع موبایل جدا (DESIGN.md §۱۸.۱۲) */
export default function CoverPic({ src, mobile, eager }: { src: string; mobile?: string | null; eager?: boolean }) {
  const d = OPT.exec(src);
  const m = mobile ? OPT.exec(mobile) : null;
  return (
    <picture>
      {mobile && (m ? (
        <>
          <source media="(max-width: 767px)" type="image/avif" srcSet={set(m[1], 'avif')} sizes="100vw" />
          <source media="(max-width: 767px)" type="image/webp" srcSet={set(m[1], 'webp')} sizes="100vw" />
        </>
      ) : <source media="(max-width: 767px)" srcSet={mobile} />)}
      {d && (
        <>
          <source type="image/avif" srcSet={set(d[1], 'avif')} sizes="100vw" />
          <source type="image/webp" srcSet={set(d[1], 'webp')} sizes="100vw" />
        </>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading={eager ? 'eager' : 'lazy'} {...(eager ? { fetchPriority: 'high' as const } : {})} decoding="async" draggable={false} />
    </picture>
  );
}
