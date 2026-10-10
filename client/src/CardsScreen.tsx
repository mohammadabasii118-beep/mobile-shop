import { useState } from 'react';
import { resolveCard, type CardDef } from '@game/shared';
import type { Ctx } from './App';
import { call } from './net';
import { Bar, CardTile, Modal, RARITY_FA, fa, sortByPower } from './ui';

export function CardsScreen({ ctx }: { ctx: Ctx }) {
  const { profile: p, cfg, setProfile, toast } = ctx;
  const [open, setOpen] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const defOf = (id: string) => cfg.cards.find((c) => c.id === id)!;
  const owned = new Map(p.cards.map((c) => [c.id, c]));

  const tile = (id: string, onClick: () => void, extra?: { selected?: boolean }) => {
    const c = owned.get(id)!, def = defOf(id), s = resolveCard(def, c.level, cfg);
    const need = cfg.upgrade.levels[c.level - 1];
    return <CardTile key={id} maxLevel={cfg.upgrade.maxLevel} def={def} level={c.level} hp={s.hp} atk={s.atk} shield={s.shield} onClick={onClick} selected={extra?.selected}
      badge={need ? <div className={`dup ${c.copies >= need.copies ? 'ok' : ''}`}>{fa(c.copies)}/{fa(need.copies)}</div> : <div className="dup ok">حداکثر</div>} />;
  };

  const collection = sortByPower(p.cards.map((c) => ({ def: defOf(c.id), level: c.level })), cfg);
  const inDeck = new Set(p.deck);

  const setDeckSlot = async (slot: number, cardId: string) => {
    const next = [...p.deck];
    const existing = next.indexOf(cardId);
    if (existing >= 0) next[existing] = next[slot]; // جابجایی
    next[slot] = cardId;
    try { setProfile((await call('/api/deck', { cards: next })).profile); setOpen(null); } catch (e) { toast((e as Error).message); }
  };
  const upgrade = async (id: string) => {
    try { setProfile((await call('/api/upgrade', { cardId: id })).profile); toast('ارتقا انجام شد ✨'); setFlash(id); setTimeout(() => setFlash(null), 900); } catch (e) { toast((e as Error).message); }
  };

  const sel = open ? { def: defOf(open), c: owned.get(open)! } : null;

  return (
    <>
      <h2 className="title">ترکیب من <small>(۳ کارت)</small></h2>
      <div className="deck">{p.deck.map((id) => tile(id, () => setOpen(id), { selected: true }))}</div>
      <h2 className="title">کلکسیون <small>({fa(p.cards.length)} کارت)</small></h2>
      <div className="grid">
        {collection.map(({ def }) => tile(def.id, () => setOpen(def.id), { selected: inDeck.has(def.id) }))}
      </div>
      <p className="hint">کارت‌های ناموجود از جعبه‌ها به‌دست می‌آیند. برای ارتقا کارت تکراری و سکه لازم است.</p>

      {sel && <Detail flash={flash === sel.def.id} def={sel.def} level={sel.c.level} copies={sel.c.copies} cfg={ctx.cfg} coins={p.coins} deck={p.deck}
        onClose={() => setOpen(null)} onUpgrade={() => upgrade(sel.def.id)} onSlot={(s) => setDeckSlot(s, sel.def.id)} />}
    </>
  );
}

function Detail({ flash, def, level, copies, cfg, coins, deck, onClose, onUpgrade, onSlot }: {
  flash: boolean; def: CardDef; level: number; copies: number; cfg: Ctx['cfg']; coins: number; deck: string[];
  onClose: () => void; onUpgrade: () => void; onSlot: (s: number) => void;
}) {
  const s = resolveCard(def, level, cfg);
  const next = level < cfg.upgrade.maxLevel ? resolveCard(def, level + 1, cfg) : null;
  const need = cfg.upgrade.levels[level - 1];
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
          {def.desc && <p className="ability">✦ {def.desc}</p>}
        </div>
      </div>
      {need ? (
        <>
          <Bar value={copies} max={need.copies} />
          <small>کارت تکراری {fa(copies)}/{fa(need.copies)} — هزینه 🪙 {fa(need.coins)}</small>
          <button className="btn" disabled={!can} onClick={onUpgrade}>ارتقا به لول {fa(level + 1)}</button>
        </>
      ) : <p>این کارت در بالاترین لول است 👑</p>}
      <div className="slotpick">
        <small>قرار دادن در ترکیب:</small>
        <div className="row">
          {[0, 1, 2].map((i) => (
            <button key={i} className="btn ghost" disabled={deck[i] === def.id} onClick={() => onSlot(i)}>جایگاه {fa(i + 1)}</button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
