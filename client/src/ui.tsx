import { useState, type ReactNode } from 'react';
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
  maxLevel?: number;
}
export function CardTile(p: TileProps) {
  const maxL = p.maxLevel ?? 6;
  const body = (
    <div className="in">
      <div className="emb">
        <CardArt key={p.def.image ?? p.def.id} card={p.def} />
        <span className="lvb">لول {fa(p.level)}</span>
        {p.def.ability && <span className="abl"><Icon n="spark" /></span>}
      </div>
      <div className="nm">{p.def.name}</div>
      <div className="st">
        <span><Icon n="heart" />{fa(p.hp)}</span><span><Icon n="sword" />{fa(p.atk)}</span><span><Icon n="shield" />{fa(p.shield)}</span>
      </div>
      <div className="pips">{Array.from({ length: maxL }, (_, i) => <i key={i} className={`pip ${i < p.level ? 'on' : ''}`} />)}</div>
    </div>
  );
  const cls = `card ${p.dead ? 'dead' : ''} ${p.selected ? 'sel' : ''} ${p.small ? 'small' : ''} ${p.className ?? ''}`;
  return (
    <div className="cardwrap">
      {p.onClick || p.disabled !== undefined
        ? <button className={cls} data-r={p.def.rarity} data-tier={tierOf(p.level)} onClick={p.onClick} disabled={!p.onClick || p.disabled}>{body}</button>
        : <div className={cls} data-r={p.def.rarity} data-tier={tierOf(p.level)}>{body}</div>}
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
