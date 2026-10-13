/** لوگوی Caseline: نشان دایره‌ای فیروزه‌ای فروشگاه (DESIGN.md §۱۸.۱۳)؛ تزئینی، نام کنار آن نوشته می‌شود */
export default function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} src="/brand/emblem.png" width={size} height={size} alt="" aria-hidden="true" decoding="async" draggable={false} style={{ flex: 'none', display: 'block', objectFit: 'contain' }} />
  );
}
