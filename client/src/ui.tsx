import { useId, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { CardDef, GameConfig } from '@game/shared';
import { resolveCard } from '@game/shared';

export const fa = (n: number) => Math.round(n).toLocaleString('fa-IR');
/** نوع کارت: ساده (برنزی)، معمولی (نقره‌ای)، کمیاب (طلایی) */
export const RARITY_FA = { common: 'ساده', rare: 'معمولی', epic: 'کمیاب' } as const;
const RARITY_ORDER = { common: 0, rare: 1, epic: 2 } as const;
export const cardPower = (c: { hp: number; atk: number; shield: number }) => c.hp + c.shield + c.atk * 3;
export const sortByPower = <T extends { def: CardDef; level: number }>(a: T[], cfg: GameConfig) =>
  [...a].sort((x, y) => {
    const rx = RARITY_ORDER[x.def.rarity], ry = RARITY_ORDER[y.def.rarity];
    return ry - rx || cardPower(resolveCard(y.def, y.level, cfg)) - cardPower(resolveCard(x.def, x.level, cfg));
  });

/** قاب کارت با لول عوض می‌شود: برنزی (۱–۲)، نقره‌ای (۳–۴)، زرین (۵ به بعد) */
/** قاب کارت فقط به نوع کارت بستگی دارد: ساده برنزی، معمولی نقره‌ای، کمیاب طلایی (لول فقط ستاره‌ها را زیاد می‌کند) */
export const frameOf = (r: string) => (r === 'epic' ? 'gold' : r === 'rare' ? 'silver' : 'bronze');
export const tierOf = (level: number) => (level >= 5 ? 'gold' : level >= 3 ? 'silver' : 'bronze');

export function Icon({ n }: { n: 'heart' | 'sword' | 'shield' | 'coin' | 'spark' }) {
  const paths = {
    heart: <path d="M12 20s-7-4.4-9-9c-1.2-3 .6-6.5 4-6.5 2 0 3.7 1.1 5 3 1.3-1.9 3-3 5-3 3.4 0 5.2 3.5 4 6.5-2 4.6-9 9-9 9z" />,
    sword: <path d="M5 19L17 7M14 4h6v6M6 14l4 4M4 20l2-2" />,
    shield: <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />,
    coin: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /></>,
    spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  };
  return <svg className={`i ${n === 'heart' || n === 'spark' ? 'f' : ''}`} viewBox="0 0 24 24" aria-hidden="true">{paths[n]}</svg>;
}

/** الماس سرخ (همه‌جا یک شکل) */
export function Gem({ className = 'gemi' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <defs><linearGradient id="gemg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff7a86" /><stop offset="1" stopColor="#b3122e" /></linearGradient></defs>
      <path d="M6 3h12l4 6-10 12L2 9z" fill="url(#gemg)" stroke="#ffd0d6" strokeWidth="1" strokeLinejoin="round" />
      <path d="M2 9h20M9 3l-2 6 5 12 5-12-2-6" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth=".8" />
    </svg>
  );
}

function Emblem({ glyph }: { glyph: string }) {
  return (
    <svg className="e" viewBox="0 0 100 100" aria-hidden="true">
      <g fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.5">
        <rect x="18" y="18" width="64" height="64" />
        <rect x="18" y="18" width="64" height="64" transform="rotate(45 50 50)" />
        <circle cx="50" cy="50" r="30" />
      </g>
      <circle cx="50" cy="50" r="22" fill="rgba(0,0,0,.35)" stroke="rgba(255,255,255,.55)" strokeWidth="2" />
      <text x="50" y="60" textAnchor="middle" fontSize="32" fontFamily="Lalezar, Vazirmatn, sans-serif" fill="#fff">{glyph}</text>
    </svg>
  );
}

/** آرت کارت: عکس آپلودشده از پنل مدیریت → فایل assets/cards/<id>.png → نشان پیش‌فرض */
export function CardArt({ card }: { card: Pick<CardDef, 'id' | 'name' | 'image'> }) {
  const [step, setStep] = useState(card.image ? 0 : 1);
  const src = step === 0 ? card.image : step === 1 ? `/assets/cards/${card.id}.png` : null;
  return src ? <img className="pic" src={src} alt="" onError={() => setStep(step + 1)} /> : <Emblem glyph={[...card.name][0] ?? '؟'} />;
}

export interface TileProps {
  def: CardDef; level: number; hp: number; atk: number; shield: number;
  dead?: boolean; selected?: boolean; onClick?: () => void; disabled?: boolean; badge?: ReactNode; className?: string; small?: boolean;
  maxLevel?: number; hidePips?: boolean;
}
/**
 * اندازه‌ی فونت را طوری کم می‌کند که متن در عرض مجاز جا شود (با فونت واقعی؛ با لود فونت دوباره حساب می‌شود).
 * هر قدر اسم یا عدد بلندتر باشد، فونت کوچک‌تر می‌شود تا از کادر بیرون نزند.
 */
let measureCtx: CanvasRenderingContext2D | null = null;
const fontSubscribe = (f: () => void) => { document.fonts?.addEventListener('loadingdone', f); return () => document.fonts?.removeEventListener('loadingdone', f); };
let fontsVersion = 0;
if (typeof document !== 'undefined') document.fonts?.addEventListener('loadingdone', () => { fontsVersion++; });
function fitSize(text: string, maxW: number, maxSize: number, minSize: number): number {
  try {
    measureCtx ??= document.createElement('canvas').getContext('2d');
    if (!measureCtx) return maxSize;
    measureCtx.font = `900 ${maxSize}px Lalezar, Vazirmatn, Tahoma, sans-serif`;
    const w = measureCtx.measureText(text).width;
    return w <= maxW ? maxSize : Math.max(minSize, Math.floor((maxSize * maxW) / w));
  } catch { return maxSize; }
}

/** مختصات متن روی هر سه قاب (مقیاس ۸۰۰×۱۱۰۸): خمِ اسم، جای «لول»، و مرکز دایره‌های جان، شیلد و دمیج */
/** مرکز نشان گردِ «لول» (گوشه‌ی بالا چپ پنجره‌ی عکس؛ زیر آویز قاب کمیاب) */
const LV = [140, 396] as const;
const FRAME = {
  common: { n: 1, ny: 122, lv: [198, 150], c: [[710, 486], [710, 681], [710, 877]] },
  rare: { n: 2, ny: 144, lv: [238, 176], c: [[703, 490], [703, 683], [703, 878]] },
  epic: { n: 3, ny: 138, lv: [236, 184], c: [[705, 484], [705, 673], [705, 860]] },
} as const;

/**
 * کارت: عکس کامل داخل قاب گریفین (ساده / معمولی / کمیاب هرکدام قاب خودشان را دارند).
 * اسم روی کتیبه و جان، شیلد و دمیج داخل دایره‌های کاغذی، همه مشکی و مثل جوهر روی کاغذ.
 */
export function CardTile(p: TileProps) {
  const f = FRAME[p.def.rarity];
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const inkId = `ink${uid}`;
  useSyncExternalStore(fontSubscribe, () => fontsVersion); // بعد از لود فونت‌ها اندازه‌ها دوباره حساب شوند
  const nameSize = fitSize(p.def.name, 330, 70, 34);
  const body = (
    <>
      <div className="part" style={{ ['--wm' as string]: `url(/assets/window-${f.n}.webp)` }}>
        <div className="pbg" />
        <div className="pbox"><CardArt key={p.def.image ?? p.def.id} card={p.def} /></div>
      </div>
      <img className="pfr" src={`/assets/frame-${f.n}.webp`} alt="" draggable={false} />
      <svg className="ptx" viewBox="0 0 800 1108" aria-hidden>
        <defs>
          <filter id={inkId} x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="3" result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="2.200" /></filter>
        </defs>
        <g className="lvb">
          <circle cx={LV[0]} cy={LV[1]} r="58" fill="#e9d6a6" stroke="#8a5a14" strokeWidth="7" />
          <circle cx={LV[0]} cy={LV[1]} r="47" fill="none" stroke="#b98a35" strokeWidth="3" />
        </g>
        <g className="ink" filter={`url(#${inkId})`}>
          <text className="pnm" x="400" y={f.ny} textAnchor="middle" dominantBaseline="central" style={{ fontSize: nameSize }}>{p.def.name}</text>
          <text className="plb" x={LV[0]} y={LV[1] - 17} textAnchor="middle">لول</text>
          <text className="pln" x={LV[0]} y={LV[1] + 24} textAnchor="middle">{fa(p.level)}</text>
          {[p.hp, p.shield, p.atk].map((v, i) => (
            <text key={i} className="pn" x={f.c[i][0]} y={f.c[i][1]} textAnchor="middle" style={{ fontSize: fitSize(fa(v), 84, 84, 40) }}>{fa(v)}</text>
          ))}
        </g>
      </svg>
    </>
  );
  const cls = `card par ${p.dead ? 'dead' : ''} ${p.selected ? 'sel' : ''} ${p.small ? 'small' : ''} ${p.className ?? ''}`;
  return (
    <div className="cardwrap">
      {p.onClick || p.disabled !== undefined
        ? <button className={cls} data-r={p.def.rarity} onClick={p.onClick} disabled={!p.onClick || p.disabled}>{body}</button>
        : <div className={cls} data-r={p.def.rarity}>{body}</div>}
      {p.badge}
    </div>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

export function Bar({ value, max, color = 'var(--gold)' }: { value: number; max: number; color?: string }) {
  return <div className="bar"><i style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} /></div>;
}

export function fmtTime(ms: number) {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return [h, m, r].map((x) => fa(x).padStart(2, '۰')).join(':');
}
