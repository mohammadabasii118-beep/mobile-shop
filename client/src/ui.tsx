import { useState, type ReactNode } from 'react';
import type { CardDef, GameConfig } from '@game/shared';
import { resolveCard } from '@game/shared';

export const fa = (n: number) => Math.round(n).toLocaleString('fa-IR');
export const RARITY_FA = { common: 'معمولی', rare: 'نادر', epic: 'حماسی' } as const;
const RARITY_ORDER = { common: 0, rare: 1, epic: 2 } as const;
export const cardPower = (c: { hp: number; atk: number; shield: number }) => c.hp + c.shield + c.atk * 3;
export const sortByPower = <T extends { def: CardDef; level: number }>(a: T[], cfg: GameConfig) =>
  [...a].sort((x, y) => {
    const rx = RARITY_ORDER[x.def.rarity], ry = RARITY_ORDER[y.def.rarity];
    return ry - rx || cardPower(resolveCard(y.def, y.level, cfg)) - cardPower(resolveCard(x.def, x.level, cfg));
  });

/** آرت کارت: اگه فایل assets/cards/<id>.png بود نشون داده می‌شه، وگرنه placeholder رنگی */
export function CardArt({ id, name, rarity }: { id: string; name: string; rarity: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`art r-${rarity}`}>
      {!broken && <img src={`/assets/cards/${id}.png`} alt="" onError={() => setBroken(true)} />}
      {broken && <span className="ph">{name.slice(0, 1)}</span>}
    </div>
  );
}

export interface TileProps {
  def: CardDef; level: number; hp: number; atk: number; shield: number;
  maxHp?: number; dead?: boolean; selected?: boolean; onClick?: () => void; badge?: ReactNode; className?: string; small?: boolean;
}
export function CardTile(p: TileProps) {
  return (
    <button className={`card r-${p.def.rarity} ${p.dead ? 'dead' : ''} ${p.selected ? 'sel' : ''} ${p.small ? 'small' : ''} ${p.className ?? ''}`} onClick={p.onClick} disabled={!p.onClick}>
      <CardArt id={p.def.id} name={p.def.name} rarity={p.def.rarity} />
      <div className="cname">{p.def.name}</div>
      <div className="lvl">لول {fa(p.level)}</div>
      <div className="stats">
        <span title="جان">❤ {fa(p.hp)}</span>
        <span title="حمله">⚔ {fa(p.atk)}</span>
        <span title="شیلد">🛡 {fa(p.shield)}</span>
      </div>
      {p.def.ability && <div className="ab">✦</div>}
      {p.badge}
    </button>
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
  return [h, m, r].map((x) => String(x).padStart(2, '0')).join(':');
}
