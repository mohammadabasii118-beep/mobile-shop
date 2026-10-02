import { memo, useId } from 'react';
import type { ArtKind } from '@/types';

/** تصویر برداری محصول (جایگزین عکس واقعی تا زمان اتصال به CDN) */
function ProductArtBase({ kind, color = '#8B5CF6', className = '' }: { kind: ArtKind; color?: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  const g = `g${id}`, s = `s${id}`;
  const defs = (
    <defs>
      <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={color} /><stop offset="1" stopColor="#0c0c0c" stopOpacity=".85" />
      </linearGradient>
      <linearGradient id={s} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity=".5" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <filter id={`b${id}`}><feGaussianBlur stdDeviation="14" /></filter>
    </defs>
  );
  const shadow = <ellipse cx="100" cy="188" rx="52" ry="7" fill="#000" opacity=".5" filter={`url(#b${id})`} />;
  let body: JSX.Element;
  switch (kind) {
    case 'case':
      body = (<g>
        <rect x="56" y="14" width="88" height="170" rx="22" fill={`url(#${g})`} stroke="#fff" strokeOpacity=".25" strokeWidth="1.5" />
        <rect x="64" y="22" width="72" height="154" rx="16" fill="#0c0c0c" opacity=".25" />
        <rect x="66" y="28" width="38" height="40" rx="11" fill="#0c0c0c" opacity=".7" stroke="#fff" strokeOpacity=".3" />
        <circle cx="78" cy="40" r="7" fill="#1b1b1f" stroke="#fff" strokeOpacity=".4" /><circle cx="94" cy="40" r="5" fill="#1b1b1f" stroke="#fff" strokeOpacity=".4" />
        <circle cx="78" cy="57" r="7" fill="#1b1b1f" stroke="#fff" strokeOpacity=".4" />
        <circle cx="100" cy="112" r="20" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="2" />
        <path d="M60 30 Q70 100 60 170" stroke={`url(#${s})`} strokeWidth="6" fill="none" opacity=".6" />
      </g>); break;
    case 'glass':
      body = (<g>
        <rect x="58" y="12" width="84" height="172" rx="18" fill="#cfe8ff" opacity=".12" stroke={color} strokeWidth="2.5" />
        <rect x="66" y="20" width="68" height="156" rx="12" fill={`url(#${g})`} opacity=".25" />
        <path d="M72 20 L128 20 L72 120 Z" fill="#fff" opacity=".12" />
        <rect x="88" y="26" width="24" height="6" rx="3" fill="#fff" opacity=".4" />
      </g>); break;
    case 'charger':
      body = (<g>
        <rect x="64" y="46" width="72" height="92" rx="18" fill={`url(#${g})`} stroke="#fff" strokeOpacity=".25" />
        <rect x="86" y="130" width="28" height="30" rx="4" fill="#d7e2ea" /><rect x="86" y="64" width="28" height="12" rx="6" fill="#0c0c0c" opacity=".8" />
        <rect x="76" y="26" width="6" height="22" rx="2" fill="#d7e2ea" /><rect x="118" y="26" width="6" height="22" rx="2" fill="#d7e2ea" />
        <path d="M72 52 Q70 90 74 130" stroke={`url(#${s})`} strokeWidth="5" fill="none" />
      </g>); break;
    case 'cable':
      body = (<g fill="none" strokeLinecap="round">
        <path d="M50 150 C 60 40, 150 170, 150 50" stroke={`url(#${g})`} strokeWidth="9" />
        <path d="M50 150 C 60 40, 150 170, 150 50" stroke="#fff" strokeOpacity=".3" strokeWidth="2" />
        <rect x="40" y="148" width="22" height="30" rx="6" fill="#d7e2ea" stroke="none" /><rect x="139" y="22" width="22" height="30" rx="6" fill="#d7e2ea" stroke="none" />
      </g>); break;
    case 'powerbank':
      body = (<g>
        <rect x="52" y="30" width="96" height="146" rx="20" fill={`url(#${g})`} stroke="#fff" strokeOpacity=".25" />
        {[0, 1, 2, 3].map((i) => <rect key={i} x={72 + i * 17} y="48" width="10" height="6" rx="3" fill="#fff" opacity={i < 3 ? 0.85 : 0.25} />)}
        <rect x="82" y="150" width="36" height="9" rx="4" fill="#0c0c0c" opacity=".8" />
        <path d="M60 36 Q58 100 62 170" stroke={`url(#${s})`} strokeWidth="6" fill="none" />
      </g>); break;
    case 'holder':
      body = (<g>
        <rect x="90" y="110" width="20" height="66" rx="8" fill="#2a2a30" /><ellipse cx="100" cy="178" rx="40" ry="8" fill="#2a2a30" />
        <rect x="62" y="24" width="76" height="100" rx="16" fill={`url(#${g})`} stroke="#fff" strokeOpacity=".25" />
        <circle cx="100" cy="74" r="14" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="2" />
      </g>); break;
    case 'adapter':
      body = (<g>
        <rect x="76" y="40" width="48" height="84" rx="14" fill={`url(#${g})`} stroke="#fff" strokeOpacity=".25" />
        <rect x="86" y="22" width="28" height="22" rx="4" fill="#d7e2ea" /><rect x="88" y="124" width="24" height="28" rx="12" fill="#d7e2ea" />
        <path d="M100 152 q0 24 -20 28" stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" />
      </g>); break;
    case 'lens':
      body = (<g>
        <circle cx="100" cy="100" r="62" fill="#0c0c0c" stroke={color} strokeWidth="6" />
        <circle cx="100" cy="100" r="44" fill="#1b1b1f" stroke="#fff" strokeOpacity=".3" strokeWidth="3" />
        <circle cx="100" cy="100" r="22" fill={`url(#${g})`} /><circle cx="90" cy="90" r="6" fill="#fff" opacity=".6" />
      </g>); break;
    default:
      body = (<g>
        <rect x="40" y="56" width="120" height="96" rx="22" fill={`url(#${g})`} stroke="#fff" strokeOpacity=".25" />
        <path d="M76 56 v-10 a10 10 0 0 1 10 -10 h28 a10 10 0 0 1 10 10 v10" fill="none" stroke={color} strokeWidth="6" />
        <path d="M40 102 H160" stroke="#fff" strokeOpacity=".25" strokeWidth="2" /><rect x="92" y="94" width="16" height="16" rx="4" fill="#d7e2ea" />
      </g>);
  }
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-hidden="true">
      {defs}
      <circle cx="100" cy="100" r="86" fill={color} opacity=".12" filter={`url(#b${id})`} />
      {shadow}{body}
    </svg>
  );
}
export const ProductArt = memo(ProductArtBase);
