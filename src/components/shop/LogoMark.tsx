/** نشان Caseline (DESIGN.md §۱۸.۱۳)؛ رنگ‌ها فقط از توکن‌های CSS */
export default function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={{ flex: 'none', display: 'block' }}>
      <rect width="64" height="64" rx="15" style={{ fill: 'var(--action)' }} />
      <rect x="18.5" y="9" width="27" height="46" rx="9" fill="none" stroke="#fff" strokeWidth="4" />
      <rect x="23" y="13.5" width="15.5" height="15.5" rx="4.6" style={{ fill: 'var(--charge)' }} />
      <circle cx="28" cy="18.5" r="2.2" style={{ fill: 'var(--on-charge)' }} />
      <circle cx="34" cy="18.5" r="2.2" style={{ fill: 'var(--on-charge)' }} />
      <circle cx="28" cy="24.2" r="2.2" style={{ fill: 'var(--on-charge)' }} />
    </svg>
  );
}
