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
/** نمادهای مشترک قاب کارت (فروهر و مدالیون گل‌وبوته‌ای)؛ یک‌بار در برنامه گذاشته می‌شود */
export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <symbol id="faravahar" viewBox="0 0 90 34">
          <g fill="currentColor">
            <g id="fvw"><path d="M43 18 C34 18 22 15 3 6 C14 16 26 21 43 23Z" /><path d="M43 23 C33 23 22 21 7 15 C17 22 28 26 43 27Z" opacity=".9" /><path d="M43 27 C34 27 25 26 14 22 C23 27 31 30 43 31Z" opacity=".8" /></g>
            <use href="#fvw" transform="translate(90 0) scale(-1 1)" />
            <circle cx="45" cy="19" r="7" /><circle cx="45" cy="19" r="4.200" fill="#0b1226" /><path d="M45 4l4 8h-8z" /><path d="M45 26v7" stroke="currentColor" strokeWidth="2.500" />
          </g>
        </symbol>
        <symbol id="rosette" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="30" fill="var(--f3)" /><circle cx="32" cy="32" r="30" fill="none" stroke="var(--f1)" strokeWidth="2.500" />
          <g fill="var(--f1)" stroke="var(--f3)" strokeWidth="1">
            <ellipse cx="32" cy="9" rx="4.500" ry="7" /><ellipse cx="32" cy="55" rx="4.500" ry="7" /><ellipse cx="9" cy="32" rx="7" ry="4.500" /><ellipse cx="55" cy="32" rx="7" ry="4.500" />
            <ellipse cx="16" cy="16" rx="4" ry="6.500" transform="rotate(-45 16 16)" /><ellipse cx="48" cy="16" rx="4" ry="6.500" transform="rotate(45 48 16)" />
            <ellipse cx="16" cy="48" rx="4" ry="6.500" transform="rotate(45 16 48)" /><ellipse cx="48" cy="48" rx="4" ry="6.500" transform="rotate(-45 48 48)" />
          </g>
          <circle cx="32" cy="32" r="20" fill="var(--f2)" stroke="var(--f1)" strokeWidth="2" />
        </symbol>
      </defs>
    </svg>
  );
}

const Medal = ({ cls, label, value }: { cls: string; label: ReactNode; value: number }) => (
  <div className={`cb ${cls}`}>
    <svg viewBox="0 0 64 64" aria-hidden><use href="#rosette" /></svg>
    <small>{label}</small>
    <b className="gem">{fa(value)}</b>
  </div>
);

/** کارت: عکس کامل داخل قاب شاهانه؛ لول بالا چپ، حمله بالا راست، شیلد و جان پایین چپ */
export function CardTile(p: TileProps) {
  const body = (
    <>
      <div className="fr" />
      <div className="steps" />
      <div className="in"><div className="emb"><CardArt key={p.def.image ?? p.def.id} card={p.def} /></div></div>
      <svg className="wg" viewBox="0 0 90 34" aria-hidden><use href="#faravahar" /></svg>
      <div className="kat"><span>{p.def.name}</span></div>
      <Medal cls="lv" label="لول" value={p.level} />
      <Medal cls="dm" label={<Icon n="sword" />} value={p.atk} />
      <Medal cls="sh" label={<Icon n="shield" />} value={p.shield} />
      <Medal cls="hp" label={<Icon n="heart" />} value={p.hp} />
      {(p.def.abilities?.length ?? 0) > 0 && <span className="abl" aria-hidden><Icon n="spark" /></span>}
    </>
  );
  const cls = `card ${p.dead ? 'dead' : ''} ${p.selected ? 'sel' : ''} ${p.small ? 'small' : ''} ${p.className ?? ''}`;
  return (
    <div className="cardwrap">
      {p.onClick || p.disabled !== undefined
        ? <button className={cls} data-r={p.def.rarity} data-tier={frameOf(p.def.rarity)} onClick={p.onClick} disabled={!p.onClick || p.disabled}>{body}</button>
        : <div className={cls} data-r={p.def.rarity} data-tier={frameOf(p.def.rarity)}>{body}</div>}
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
