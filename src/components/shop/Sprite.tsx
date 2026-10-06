/** تصاویر برداری نمونه‌ی محصولات؛ تا زمان آپلود عکس واقعی در پنل مدیریت استفاده می‌شود. */
export const ART_KEYS = ['p-case', 'p-glass', 'p-cable', 'p-charger', 'p-bank', 'p-buds', 'p-holder', 'p-flash'] as const;
export const ART_LABELS: Record<string, string> = {
  'p-case': 'قاب', 'p-glass': 'گلس', 'p-cable': 'کابل', 'p-charger': 'شارژر', 'p-bank': 'پاوربانک', 'p-buds': 'هندزفری', 'p-holder': 'هولدر', 'p-flash': 'فلش',
};

export default function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="gDark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4a4e58" /><stop offset="1" stopColor="#17181c" /></linearGradient>
        <linearGradient id="gLight" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#d5d9e0" /></linearGradient>
        <linearGradient id="gBlue" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4b82ff" /><stop offset="1" stopColor="#0a3fc7" /></linearGradient>
        <linearGradient id="gSilver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f2f3f5" /><stop offset="1" stopColor="#a9aeb8" /></linearGradient>
        <linearGradient id="gGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e9f2ff" stopOpacity=".95" /><stop offset="1" stopColor="#b9d3ff" stopOpacity=".55" /></linearGradient>
        <linearGradient id="gSand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4e9da" /><stop offset="1" stopColor="#cdb79b" /></linearGradient>
        <linearGradient id="gShine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".38" /><stop offset=".5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".16" /></linearGradient>

        <symbol id="p-case" viewBox="0 0 200 200">
          <rect x="60" y="14" width="80" height="172" rx="20" style={{ fill: 'var(--tint, url(#gSand))' }} />
          <rect x="60" y="14" width="80" height="172" rx="20" fill="url(#gShine)" />
          <rect x="60" y="14" width="80" height="172" rx="20" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.5" />
          <rect x="68" y="22" width="42" height="42" rx="12" fill="#1a1b1f" />
          <circle cx="80" cy="34" r="7" fill="#33363d" stroke="#6b6f7a" strokeWidth="1.5" /><circle cx="98" cy="34" r="7" fill="#33363d" stroke="#6b6f7a" strokeWidth="1.5" /><circle cx="89" cy="52" r="7" fill="#33363d" stroke="#6b6f7a" strokeWidth="1.5" />
          <circle cx="100" cy="116" r="22" fill="none" stroke="#000" strokeOpacity=".18" strokeWidth="2" /><circle cx="100" cy="116" r="14" fill="none" stroke="#000" strokeOpacity=".18" strokeWidth="1.5" strokeDasharray="2 4" />
        </symbol>
        <symbol id="p-cable" viewBox="0 0 200 200">
          <path d="M44 150 C 44 70, 112 190, 112 106 S 156 52, 154 66" fill="none" stroke="#b4b9c3" strokeWidth="11" strokeLinecap="round" />
          <path d="M44 150 C 44 70, 112 190, 112 106 S 156 52, 154 66" fill="none" stroke="#fafafc" strokeWidth="7" strokeLinecap="round" />
          <rect x="32" y="146" width="24" height="34" rx="6" fill="url(#gDark)" /><rect x="38" y="172" width="12" height="18" rx="3" fill="url(#gSilver)" />
          <rect x="142" y="44" width="24" height="30" rx="6" fill="url(#gDark)" transform="rotate(8 154 59)" /><rect x="146" y="26" width="16" height="20" rx="4" fill="url(#gSilver)" transform="rotate(8 154 36)" />
        </symbol>
        <symbol id="p-charger" viewBox="0 0 200 200">
          <rect x="82" y="30" width="9" height="30" rx="2" fill="#a2a7b2" /><rect x="109" y="30" width="9" height="30" rx="2" fill="#a2a7b2" />
          <rect x="50" y="56" width="100" height="112" rx="22" fill="url(#gLight)" />
          <rect x="50" y="56" width="100" height="112" rx="22" fill="none" stroke="#fff" strokeWidth="1.5" />
          <rect x="78" y="118" width="44" height="14" rx="7" fill="#1d1f24" /><rect x="86" y="123" width="28" height="4" rx="2" fill="#4a4e58" />
          <circle cx="100" cy="86" r="5" fill="#d6ff3d" stroke="#111216" strokeWidth="2" />
          <path d="M58 70 Q 100 62 142 70" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".8" />
        </symbol>
        <symbol id="p-bank" viewBox="0 0 200 200">
          <rect x="54" y="20" width="92" height="160" rx="22" fill="url(#gDark)" />
          <rect x="54" y="20" width="92" height="160" rx="22" fill="none" stroke="#fff" strokeOpacity=".18" strokeWidth="1.5" />
          <rect x="72" y="40" width="56" height="8" rx="4" fill="#0c0d10" />
          <circle cx="80" cy="44" r="2.6" fill="#d6ff3d" /><circle cx="92" cy="44" r="2.6" fill="#d6ff3d" /><circle cx="104" cy="44" r="2.6" fill="#d6ff3d" /><circle cx="116" cy="44" r="2.6" fill="#4a4e58" />
          <rect x="86" y="150" width="28" height="12" rx="6" fill="#0c0d10" />
          <path d="M96 78 L84 106 H98 L92 130 L116 96 H101 L106 78 Z" fill="#d6ff3d" opacity=".95" />
        </symbol>
        <symbol id="p-buds" viewBox="0 0 200 200">
          <rect x="46" y="96" width="108" height="76" rx="34" fill="url(#gLight)" />
          <rect x="46" y="96" width="108" height="76" rx="34" fill="none" stroke="#fff" strokeWidth="1.5" />
          <path d="M48 130 H152" stroke="#c4c8d0" strokeWidth="2" /><circle cx="100" cy="146" r="4" fill="#d6ff3d" stroke="#111216" strokeWidth="1.5" />
          <ellipse cx="76" cy="62" rx="15" ry="20" fill="url(#gLight)" stroke="#c4c8d0" strokeWidth="1.5" /><rect x="84" y="62" width="8" height="34" rx="4" fill="#e3e6eb" stroke="#c4c8d0" strokeWidth="1.2" />
          <ellipse cx="124" cy="62" rx="15" ry="20" fill="url(#gLight)" stroke="#c4c8d0" strokeWidth="1.5" /><rect x="108" y="62" width="8" height="34" rx="4" fill="#e3e6eb" stroke="#c4c8d0" strokeWidth="1.2" />
        </symbol>
        <symbol id="p-glass" viewBox="0 0 200 200">
          <rect x="56" y="16" width="88" height="168" rx="16" fill="url(#gGlass)" stroke="#fff" strokeWidth="2" />
          <rect x="64" y="24" width="72" height="152" rx="10" fill="none" stroke="#8fb4f5" strokeOpacity=".55" strokeWidth="1" />
          <rect x="86" y="30" width="28" height="7" rx="3.5" fill="#6d93d8" opacity=".5" />
          <path d="M62 140 L118 22 L132 22 L74 170 Z" fill="#fff" opacity=".5" /><path d="M104 176 L140 96 L144 108 L120 176 Z" fill="#fff" opacity=".35" />
        </symbol>
        <symbol id="p-holder" viewBox="0 0 200 200">
          <rect x="92" y="108" width="16" height="56" rx="8" fill="url(#gSilver)" />
          <rect x="64" y="156" width="72" height="18" rx="9" fill="url(#gDark)" />
          <circle cx="100" cy="72" r="48" fill="url(#gDark)" /><circle cx="100" cy="72" r="48" fill="none" stroke="#fff" strokeOpacity=".2" strokeWidth="1.5" />
          <circle cx="100" cy="72" r="32" fill="none" stroke="#6b6f7a" strokeWidth="2" /><circle cx="100" cy="72" r="16" fill="#0c0d10" /><circle cx="100" cy="72" r="4" fill="#d6ff3d" />
        </symbol>
        <symbol id="p-flash" viewBox="0 0 200 200">
          <rect x="132" y="82" width="46" height="36" rx="6" fill="url(#gSilver)" /><rect x="144" y="92" width="8" height="16" rx="2" fill="#6b6f7a" /><rect x="158" y="92" width="8" height="16" rx="2" fill="#6b6f7a" />
          <rect x="22" y="66" width="116" height="68" rx="18" fill="url(#gBlue)" />
          <rect x="22" y="66" width="116" height="68" rx="18" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.5" />
          <circle cx="52" cy="100" r="9" fill="#0a3fc7" stroke="#fff" strokeOpacity=".7" strokeWidth="2" />
          <path d="M72 88 H118 M72 100 H108 M72 112 H100" stroke="#fff" strokeOpacity=".7" strokeWidth="3" strokeLinecap="round" />
        </symbol>
      </defs>
    </svg>
  );
}
