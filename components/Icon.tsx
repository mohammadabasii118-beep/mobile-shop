const PATHS: Record<string, string> = {
  case: '<rect x="6" y="2" width="12" height="20" rx="3"/><line x1="10" y1="18" x2="14" y2="18"/>',
  airpods: '<circle cx="8" cy="8" r="3"/><path d="M8 11v6a2 2 0 0 0 4 0v-1"/><circle cx="16" cy="8" r="3"/><path d="M16 11v6a2 2 0 0 1-4 0"/>',
  cable: '<path d="M8 2v6M16 2v6M6 8h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6z"/><path d="M12 17v3M9 22h6"/>',
  protector: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/>',
  holder: '<circle cx="12" cy="7" r="4"/><path d="M12 11v7M8 22h8"/>',
  watch: '<rect x="8" y="7" width="8" height="10" rx="2"/><path d="M9.5 7V4h5v3M9.5 17v3h5v-3"/>',
  accessory: '<path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>',
  truck: '<rect x="2" y="7" width="11" height="8" rx="1"/><path d="M13 10h4l3 3v2h-7z"/><circle cx="6.5" cy="17.5" r="1.5"/><circle cx="17" cy="17.5" r="1.5"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/><path d="M9 12l2 2 4-4"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
  return: '<path d="M4 9h9a5 5 0 1 1 0 10h-2"/><path d="M8 5 4 9l4 4"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  bag: '<path d="M6 8h12l-1 12H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  x: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  alert: '<path d="M12 3 2 20h20z"/><line x1="12" y1="9" x2="12" y2="14"/><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  heart: '<path d="M12 21s-7.5-4.6-10-9.1C.5 8.3 2.2 5 5.6 5c2 0 3.4 1.1 4.4 2.6C11 6.1 12.4 5 14.4 5c3.4 0 5.1 3.3 3.6 6.9C19.5 16.4 12 21 12 21z"/>',
  compare: '<rect x="3" y="3" width="10" height="10" rx="2"/><rect x="11" y="11" width="10" height="10" rx="2"/>',
};

export default function Icon({ name, className = "w-5 h-5", filled = false }: { name: keyof typeof PATHS | string; className?: string; filled?: boolean }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      dangerouslySetInnerHTML={{ __html: d }}
    />
  );
}
