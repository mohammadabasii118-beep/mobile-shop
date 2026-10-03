import { shade, luminance } from "@/lib/color";
import type { ProductKind } from "@/types/product";

interface Props {
  kind: ProductKind;
  color: string;
  /** alt = زاویهٔ دوم (تصویر hover) */
  view?: "main" | "alt";
  className?: string;
  label?: string;
}

/**
 * تصویرسازی برداری محصول — fallback دو‌بعدی 3D و تصویر پیش‌فرض تا زمان عکاسی.
 * viewBox ثابت ۲۴۰×۲۴۰ تا هیچ layout shift ای نداشته باشد.
 */
export function ProductArt({ kind, color, view = "main", className, label }: Props) {
  const dark = luminance(color) < 0.45;
  const hi = dark ? "#ffffff" : "#ffffff";
  const rot = view === "alt" ? 14 : -8;
  const uid = `${kind}-${color.slice(1)}-${view}`;

  return (
    <svg viewBox="0 0 240 240" role="img" aria-label={label ?? "تصویر محصول"} className={className} fill="none">
      <defs>
        <filter id={`b-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <ellipse cx="120" cy="214" rx="56" ry="7" fill="#000" opacity="0.2" filter={`url(#b-${uid})`} />
      <g transform={`rotate(${rot} 120 120)${view === "alt" ? " translate(6 0) scale(1.04)" : ""}`}>
        {kind === "case" && <Case color={color} hi={hi} alt={view === "alt"} />}
        {kind === "charger" && <Charger color={color} hi={hi} />}
        {kind === "adapter" && <Adapter color={color} hi={hi} />}
        {kind === "earbuds" && <Earbuds color={color} hi={hi} alt={view === "alt"} />}
        {kind === "powerbank" && <Powerbank color={color} hi={hi} />}
        {kind === "cable" && <Cable color={color} />}
        {kind === "glass" && <Glass color={color} />}
      </g>
    </svg>
  );
}

type P = { color: string; hi: string };

const lens = (cx: number, cy: number, r = 6.5) => (
  <g key={`${cx}${cy}`}>
    <circle cx={cx} cy={cy} r={r + 2} fill="#0c0d0f" />
    <circle cx={cx} cy={cy} r={r} fill="#17181c" stroke="#3a3d45" strokeWidth="1.2" />
    <circle cx={cx - 1.8} cy={cy - 1.8} r="1.6" fill="#fff" opacity="0.5" />
  </g>
);

function Case({ color, hi, alt }: P & { alt: boolean }) {
  return (
    <g>
      <rect x="80" y="22" width="80" height="172" rx="24" fill={shade(color, -0.22)} />
      <rect x="82" y="20" width="76" height="172" rx="22" fill={color} />
      <rect x="82.5" y="20.5" width="75" height="171" rx="21.5" stroke={hi} strokeOpacity="0.22" />
      <rect x="90" y="28" width="40" height="40" rx="12" fill={shade(color, -0.16)} stroke={hi} strokeOpacity="0.15" />
      {lens(102, 40)}
      {lens(119, 40)}
      {lens(110.5, 56)}
      <circle cx="120" cy="124" r="23" stroke={hi} strokeOpacity={alt ? 0.38 : 0.2} strokeWidth="1.5" />
      <circle cx="120" cy="124" r="14" stroke={hi} strokeOpacity="0.12" />
      <path d="M96 168h48" stroke={hi} strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function Charger({ color, hi }: P) {
  return (
    <g>
      <path d="M150 168c28 8 38 22 22 38" stroke={shade(color, -0.3)} strokeWidth="7" strokeLinecap="round" />
      <circle cx="120" cy="112" r="62" fill={shade(color, -0.25)} />
      <circle cx="120" cy="108" r="62" fill={color} />
      <circle cx="120" cy="108" r="62" stroke={hi} strokeOpacity="0.2" />
      <circle cx="120" cy="108" r="42" stroke={hi} strokeOpacity="0.18" strokeWidth="1.5" />
      <circle cx="120" cy="108" r="14" fill={shade(color, -0.15)} stroke={hi} strokeOpacity="0.25" />
      <circle cx="120" cy="108" r="3" fill={hi} opacity="0.7" />
    </g>
  );
}

function Adapter({ color, hi }: P) {
  return (
    <g>
      <rect x="104" y="30" width="10" height="26" rx="2" fill="#b9bcc2" />
      <rect x="126" y="30" width="10" height="26" rx="2" fill="#b9bcc2" />
      <rect x="72" y="52" width="96" height="124" rx="22" fill={shade(color, -0.2)} />
      <rect x="72" y="48" width="96" height="124" rx="22" fill={color} stroke={hi} strokeOpacity="0.2" />
      <rect x="92" y="150" width="56" height="9" rx="4.5" fill={shade(color, -0.55)} />
      <rect x="92" y="130" width="56" height="9" rx="4.5" fill={shade(color, -0.55)} />
      <text x="120" y="96" textAnchor="middle" fontSize="14" fontWeight="700" fill={hi} opacity="0.55">65W</text>
    </g>
  );
}

function Earbuds({ color, hi, alt }: P & { alt: boolean }) {
  return (
    <g>
      <rect x="58" y="108" width="124" height="86" rx="42" fill={shade(color, -0.22)} />
      <rect x="58" y="104" width="124" height="86" rx="42" fill={color} stroke={hi} strokeOpacity="0.2" />
      <path d="M62 140h116" stroke={shade(color, -0.3)} strokeWidth="1.5" />
      <circle cx="120" cy="166" r="4" fill={hi} opacity="0.5" />
      <g transform={alt ? "translate(0 -6)" : ""}>
        <rect x="76" y="46" width="22" height="46" rx="11" fill={color} stroke={hi} strokeOpacity="0.25" />
        <circle cx="84" cy="52" r="14" fill={color} stroke={hi} strokeOpacity="0.25" />
        <rect x="142" y="46" width="22" height="46" rx="11" fill={color} stroke={hi} strokeOpacity="0.25" />
        <circle cx="156" cy="52" r="14" fill={color} stroke={hi} strokeOpacity="0.25" />
      </g>
    </g>
  );
}

function Powerbank({ color, hi }: P) {
  return (
    <g>
      <rect x="70" y="40" width="100" height="164" rx="26" fill={shade(color, -0.22)} />
      <rect x="70" y="34" width="100" height="164" rx="26" fill={color} stroke={hi} strokeOpacity="0.22" />
      <circle cx="120" cy="104" r="26" stroke={hi} strokeOpacity="0.22" strokeWidth="1.5" />
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={98 + i * 15} cy="162" r="3.5" fill={i < 3 ? "#c8f135" : hi} opacity={i < 3 ? 1 : 0.25} />
      ))}
      <rect x="104" y="44" width="32" height="7" rx="3.5" fill={shade(color, -0.55)} />
    </g>
  );
}

function Cable({ color }: { color: string }) {
  return (
    <g>
      <path d="M62 70c40-34 96-6 82 30s-70 22-62 60 70 36 100 4" stroke={shade(color, -0.25)} strokeWidth="11" strokeLinecap="round" />
      <path d="M62 70c40-34 96-6 82 30s-70 22-62 60 70 36 100 4" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray="2 4" />
      <rect x="44" y="52" width="26" height="32" rx="8" fill="#c9cbd0" transform="rotate(-24 57 68)" />
      <rect x="168" y="158" width="26" height="32" rx="8" fill="#c9cbd0" transform="rotate(30 181 174)" />
    </g>
  );
}

function Glass({ color }: { color: string }) {
  return (
    <g>
      <rect x="76" y="24" width="88" height="176" rx="22" fill="#14161a" stroke={color} strokeWidth="2.5" />
      <rect x="86" y="34" width="68" height="156" rx="14" fill="#1d2025" />
      <path d="M132 34h22v36L106 190H86v-14z" fill="#fff" opacity="0.08" />
      <rect x="108" y="40" width="24" height="6" rx="3" fill="#0b0c0e" />
    </g>
  );
}
