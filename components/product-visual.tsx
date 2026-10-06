export type Kind = "case" | "glass" | "charger" | "cable" | "earbuds" | "powerbank" | "holder" | "flash" | "lens" | "airpods" | "watch";

const KINDS = { case: 1, glass: 1, charger: 1, cable: 1, earbuds: 1, powerbank: 1, holder: 1, flash: 1, lens: 1, airpods: 1, watch: 1 };

/** Original vector illustrations of accessories, tinted per product. */
export function ProductVisual({ kind: rawKind, hue, className }: { kind: Kind | string; hue: number; className?: string }) {
  const kind = (rawKind in KINDS ? rawKind : "case") as Kind;
  const a = `hsl(${hue} 80% 58%)`;
  const b = `hsl(${(hue + 30) % 360} 70% 40%)`;
  const id = `g-${kind}-${hue}`;
  const body = {
    case: (<><rect x="62" y="30" width="76" height="140" rx="16" fill={`url(#${id})`} /><rect x="72" y="40" width="26" height="30" rx="8" fill="rgb(0 0 0 / .25)" /><circle cx="80" cy="48" r="5" fill="#fff" opacity=".7" /><circle cx="92" cy="60" r="5" fill="#fff" opacity=".7" /></>),
    glass: (<><rect x="62" y="30" width="76" height="140" rx="14" fill="none" stroke={a} strokeWidth="4" /><rect x="68" y="36" width="64" height="128" rx="10" fill={a} opacity=".18" /><path d="M76 44 L112 44 L76 100Z" fill="#fff" opacity=".35" /></>),
    charger: (<><rect x="66" y="50" width="68" height="72" rx="14" fill={`url(#${id})`} /><rect x="84" y="28" width="6" height="24" rx="2" fill={b} /><rect x="110" y="28" width="6" height="24" rx="2" fill={b} /><path d="M104 66 L90 92 h10 l-4 22 16-28 h-10z" fill="#fff" opacity=".85" /><rect x="94" y="122" width="12" height="40" rx="6" fill={b} /></>),
    cable: (<><path d="M40 150 C 60 60, 140 150, 160 60" fill="none" stroke={`url(#${id})`} strokeWidth="9" strokeLinecap="round" /><rect x="150" y="34" width="20" height="30" rx="5" fill={b} /><rect x="30" y="146" width="20" height="30" rx="5" fill={b} /></>),
    earbuds: (<><rect x="58" y="40" width="30" height="46" rx="15" fill={`url(#${id})`} /><rect x="68" y="80" width="10" height="60" rx="5" fill={b} /><rect x="112" y="40" width="30" height="46" rx="15" fill={`url(#${id})`} /><rect x="122" y="80" width="10" height="60" rx="5" fill={b} /><rect x="70" y="140" width="60" height="32" rx="14" fill={a} opacity=".35" /></>),
    powerbank: (<><rect x="56" y="34" width="88" height="132" rx="16" fill={`url(#${id})`} /><rect x="70" y="52" width="60" height="8" rx="4" fill="#fff" opacity=".8" /><rect x="70" y="68" width="40" height="8" rx="4" fill="#fff" opacity=".5" /><circle cx="100" cy="132" r="14" fill="none" stroke="#fff" strokeWidth="4" opacity=".8" /></>),
    holder: (<><rect x="88" y="120" width="24" height="46" rx="8" fill={b} /><rect x="60" y="34" width="80" height="94" rx="14" fill={`url(#${id})`} /><circle cx="100" cy="82" r="20" fill="none" stroke="#fff" strokeWidth="4" opacity=".8" /></>),
    flash: (<><rect x="76" y="26" width="48" height="112" rx="10" fill={`url(#${id})`} /><rect x="86" y="138" width="28" height="30" rx="4" fill={b} /><rect x="90" y="46" width="20" height="6" rx="3" fill="#fff" opacity=".8" /></>),
    airpods: (<><rect x="46" y="70" width="108" height="84" rx="34" fill={`url(#${id})`} /><path d="M46 108 H154" stroke="rgb(0 0 0 / .25)" strokeWidth="3" /><circle cx="100" cy="132" r="6" fill="#fff" opacity=".8" /><rect x="78" y="34" width="18" height="46" rx="9" fill="#fff" opacity=".9" /><rect x="104" y="34" width="18" height="46" rx="9" fill="#fff" opacity=".75" /></>),
    watch: (<><rect x="78" y="14" width="44" height="46" rx="8" fill={b} /><rect x="78" y="140" width="44" height="46" rx="8" fill={b} /><rect x="58" y="52" width="84" height="96" rx="24" fill={`url(#${id})`} /><rect x="68" y="62" width="64" height="76" rx="16" fill="rgb(0 0 0 / .55)" /><path d="M100 78 V102 L116 112" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" /><rect x="142" y="86" width="8" height="18" rx="3" fill={a} /></>),
    lens: (<><circle cx="100" cy="100" r="58" fill={`url(#${id})`} /><circle cx="100" cy="100" r="40" fill="rgb(0 0 0 / .55)" /><circle cx="100" cy="100" r="26" fill="none" stroke="#fff" strokeWidth="3" opacity=".6" /><circle cx="86" cy="86" r="7" fill="#fff" opacity=".7" /></>),
  }[kind];
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="182" rx="50" ry="6" fill="rgb(0 0 0 / .14)" />
      {body}
    </svg>
  );
}
