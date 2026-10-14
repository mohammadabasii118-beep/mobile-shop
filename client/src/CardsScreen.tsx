import { useState } from 'react';
import { abilityLines, resolveCard, type CardDef } from '@game/shared';
import type { Ctx } from './App';
import { call } from './net';
import { Bar, CardTile, Icon, Modal, RARITY_FA, fa, sortByPower } from './ui';

export function CardsScreen({ ctx }: { ctx: Ctx }) {
  const { profile: p, cfg, setProfile, toast } = ctx;
  const [open, setOpen] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const defOf = (id: string) => cfg.cards.find((c) => c.id === id)!;
  const owned = new Map(p.cards.map((c) => [c.id, c]));

  const tile = (id: string, onClick: () => void, extra?: { selected?: boolean }) => {
    const c = owned.get(id)!, def = defOf(id), s = resolveCard(def, c.level, cfg);
    const need = cfg.upgrade.byRarity[def.rarity][c.level - 1];
    return <CardTile key={id} maxLevel={cfg.upgrade.maxLevel} def={def} level={c.level} hp={s.hp} atk={s.atk} shield={s.shield} onClick={onClick} selected={extra?.selected}
      badge={need ? <div className={`dup ${c.copies >= need.copies ? 'ok' : ''}`}>{fa(c.copies)}/{fa(need.copies)}</div> : <div className="dup ok">حداکثر</div>} />;
  };

  const inDeck = new Set(p.deck);
  // کارت‌های دارم ولی در ترکیب نیستند / کارت‌هایی که هنوز ندارم (قفل، فقط برای دیدن)
  const spare = sortByPower(p.cards.filter((c) => !inDeck.has(c.id)).map((c) => ({ def: defOf(c.id), level: c.level })), cfg);
  const rank = { common: 0, rare: 1, epic: 2 } as const;
  const missing = cfg.cards.filter((c) => !owned.has(c.id)).sort((a, b) => rank[a.rarity] - rank[b.rarity]);
  const lockedTile = (def: CardDef) => {
    const s = resolveCard(def, 1, cfg);
    return <div key={def.id} className="lockedcard"><CardTile def={def} level={1} maxLevel={cfg.upgrade.maxLevel} hp={s.hp} atk={s.atk} shield={s.shield} onClick={() => setOpen(def.id)} badge={<div className="dup">🔒 {RARITY_FA[def.rarity]}</div>} /></div>;
  };

  const setDeckSlot = async (slot: number, cardId: string) => {
    const next = [...p.deck];
    const existing = next.indexOf(cardId);
    if (slot >= next.length) { if (existing >= 0) next.splice(existing, 1); next.push(cardId); } // جای خالی: اضافه می‌شود
    else { if (existing >= 0) next[existing] = next[slot]; /* جابجایی */ next[slot] = cardId; }
    try { setProfile((await call('/api/deck', { cards: next })).profile); setOpen(null); } catch (e) { toast((e as Error).message); }
  };
  const removeFromDeck = async (cardId: string) => {
    try { setProfile((await call('/api/deck', { cards: p.deck.filter((x) => x !== cardId) })).profile); setOpen(null); } catch (e) { toast((e as Error).message); }
  };
  const upgrade = async (id: string) => {
    try { const j = await call('/api/upgrade', { cardId: id }); setProfile(j.profile); toast(`ارتقا انجام شد ✨${j.upgrade?.xp ? ` +${fa(j.upgrade.xp)} XP` : ''}${j.upgrade?.levelsGained ? ' — لول‌آپ!' : ''}`); setFlash(id); setTimeout(() => setFlash(null), 900); } catch (e) { toast((e as Error).message); }
  };

  const sel = open ? { def: defOf(open), c: owned.get(open) ?? null } : null;

  return (
    <>
      <h2 className="title">ترکیب من <small>({fa(p.deck.length)} از {fa(cfg.deckSize)} کارت)</small></h2>
      <div className="deck">{p.deck.map((id) => tile(id, () => setOpen(id), { selected: true }))}</div>
      {spare.length > 0 && (
        <>
          <h2 className="title">کارت‌های من <small>({fa(spare.length)} کارت)</small></h2>
          <div className="grid">{spare.map(({ def }) => tile(def.id, () => setOpen(def.id)))}</div>
        </>
      )}
      {missing.length > 0 && (
        <>
          <h2 className="title">هنوز نداری <small>({fa(missing.length)} کارت)</small></h2>
          <div className="grid">{missing.map(lockedTile)}</div>
        </>
      )}
      <p className="hint">کارت‌های قفل را از جعبه‌ها به‌دست می‌آوری. برای ارتقا تعداد کارت و سکه لازم است.</p>

      {sel && <Detail flash={flash === sel.def.id} def={sel.def} level={sel.c?.level ?? 1} copies={sel.c?.copies ?? 0} locked={!sel.c} cfg={ctx.cfg} coins={p.coins} deck={p.deck} deckSize={cfg.deckSize} onRemove={() => removeFromDeck(sel.def.id)}
        onClose={() => setOpen(null)} onUpgrade={() => upgrade(sel.def.id)} onSlot={(s) => setDeckSlot(s, sel.def.id)} />}
    </>
  );
}

function Detail({ flash, locked, def, level, copies, cfg, coins, deck, deckSize, onRemove, onClose, onUpgrade, onSlot }: {
  flash: boolean; locked: boolean; def: CardDef; level: number; copies: number; cfg: Ctx['cfg']; coins: number; deck: string[]; deckSize: number; onRemove: () => void;
  onClose: () => void; onUpgrade: () => void; onSlot: (s: number) => void;
}) {
  const s = resolveCard(def, level, cfg);
  const next = level < cfg.upgrade.maxLevel ? resolveCard(def, level + 1, cfg) : null;
  const need = cfg.upgrade.byRarity[def.rarity][level - 1];
  const can = !!need && copies >= need.copies && coins >= need.coins;
  const d = (a: number, b?: number) => (b !== undefined && b !== a ? <em> ← {fa(b)}</em> : null);
  return (
    <Modal onClose={onClose}>
      <div className="detail">
        <CardTile def={def} level={level} maxLevel={cfg.upgrade.maxLevel} className={flash ? 'evolve' : ''} hp={s.hp} atk={s.atk} shield={s.shield} />
        <div className="dinfo">
          <h3>{def.name} <small className={`rt r-${def.rarity}`}>{RARITY_FA[def.rarity]}</small></h3>
          <p>❤ جان: {fa(s.hp)}{d(s.hp, next?.hp)}</p>
          <p>⚔ حمله: {fa(s.atk)}{d(s.atk, next?.atk)}</p>
          <p>🛡 شیلد: {fa(s.shield)}{d(s.shield, next?.shield)}</p>
          {abilityLines(def.abilities, s.params, fa).map((a) => <p key={a.label} className="ability">✦ <b>{a.label}:</b> {a.text}</p>)}
          {(def.chargeAttacks ?? 0) > 0 && (def.abilities?.length ?? 0) > 0 && <p className="ability">🔥 <b>قدرت ویژه:</b> بعد از {fa(def.chargeAttacks!)} حمله، حمله‌ی بعدی همه‌ی توانایی‌هایش ۲ برابر می‌شود</p>}
          {def.desc && <p className="ability">✦ {def.desc}</p>}
        </div>
      </div>
      {locked ? <p className="hint">🔒 این کارت را هنوز نداری؛ از جعبه‌ها به‌دست می‌آید.</p> : need ? (
        <>
          <Bar value={copies} max={need.copies} />
          <small>تعداد کارت {fa(copies)}/{fa(need.copies)} — هزینه <span className="coinv"><Icon n="coin" /> {fa(need.coins)}</span></small>
          <button className="btn" disabled={!can} onClick={onUpgrade}>ارتقا به لول {fa(level + 1)}</button>
        </>
      ) : <p>این کارت در بالاترین لول است 👑</p>}
      {!locked && <div className="slotpick">
        <small>قرار دادن در ترکیب:</small>
        <div className="row">
          {Array.from({ length: deckSize }, (_, i) => (
            <button key={i} className="btn ghost" disabled={deck[i] === def.id || i > deck.length} onClick={() => onSlot(i)}>جایگاه {fa(i + 1)}</button>
          ))}
        </div>
        {deck.includes(def.id) && deck.length > 3 && <button className="btn ghost" onClick={onRemove}>خارج کردن از ترکیب</button>}
      </div>}
    </Modal>
  );
}
