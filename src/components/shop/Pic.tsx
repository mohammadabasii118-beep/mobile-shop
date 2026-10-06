import type { CSSProperties } from 'react';

/**
 * نمایش تصویر محصول/بنر.
 *  - مسیر آپلودشده:   /uploads/2026/10/abc.webp
 *  - تصویر برداری:     art:p-case             (کلید داخل Sprite)
 *  - برداری با رنگ:   art:p-case@#2f6bff     (برای قاب‌های رنگی)
 */
export function parseArt(src: string | null | undefined): { key: string; tint?: string } | null {
  if (!src || !src.startsWith('art:')) return null;
  const [key, tint] = src.slice(4).split('@');
  return { key, tint };
}

const OPT = /^(\/uploads\/.+?)\.webp$/;
const WIDTHS = [480, 960, 1600];

export default function Pic({ src, alt = '', className = 'art', eager = false, sizes = '(max-width: 640px) 50vw, 400px' }: { src: string | null | undefined; alt?: string; className?: string; eager?: boolean; sizes?: string }) {
  const art = parseArt(src);
  if (art) {
    const style = art.tint ? ({ '--tint': art.tint } as CSSProperties) : undefined;
    return (
      <svg className={className} viewBox="0 0 200 200" role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} style={style}>
        <use href={`#${art.key}`} />
      </svg>
    );
  }
  const opt = src ? OPT.exec(src) : null;
  if (src && opt) {
    const set = (ext: string) => WIDTHS.map((w) => `${opt[1]}${w === 1600 ? '' : `-${w}`}.${ext} ${w}w`).join(', ');
    return (
      <picture>
        <source type="image/avif" srcSet={set('avif')} sizes={sizes} />
        <source type="image/webp" srcSet={set('webp')} sizes={sizes} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={className} src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" />
      </picture>
    );
  }
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={className} src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" />;
  }
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden="true">
      <rect x="40" y="40" width="120" height="120" rx="24" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" strokeDasharray="6 8" />
    </svg>
  );
}
