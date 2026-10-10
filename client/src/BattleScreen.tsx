import { useEffect, useRef, useState } from 'react';
import type { BattleEvent, ServerMsg, Side, UnitView } from '@game/shared';
import type { Ctx } from './App';
import { rewardText } from './App';
import { CardTile, Modal, fa } from './ui';
import { haptic } from './telegram';

type Start = Extract<ServerMsg, { t: 'battleStart' }>;
type End = Extract<ServerMsg, { t: 'battleEnd' }>;
export interface BattleInit { start: Start }

interface Floater { id: number; uid: string; text: string; cls: string }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let floaterId = 0;

export function BattleScreen({ ctx, init, onDone, onExit, result }: {
  ctx: Ctx; init: BattleInit; onDone: (e: End) => void; onExit: () => void; result: End | null;
}) {
  const { start } = init;
  const { cfg, sock } = ctx;
  const me: Side = start.you;
  const [units, setUnits] = useState<UnitView[]>(start.units);
  const [prompt, setPrompt] = useState<{ actor: string; mine: boolean; attacksLeft: number; ms: number; at: number } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [attacking, setAttacking] = useState<string | null>(null);
  const [hit, setHit] = useState<string | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [log, setLog] = useState<string>(`${start.first === me ? 'تو' : start.opponent} شروع می‌کند`);
  const [now, setNow] = useState(Date.now());
  const queue = useRef<ServerMsg[]>([]);
  const busy = useRef(false);
  const alive = useRef(true);
  const unitsRef = useRef(start.units);
  unitsRef.current = units;
  const nameOf = (uid: string, list: UnitView[]) => list.find((u) => u.uid === uid)?.name ?? '';

  const float = (uid: string, text: string, cls: string) => {
    const f = { id: ++floaterId, uid, text, cls };
    setFloaters((x) => [...x, f]);
    setTimeout(() => setFloaters((x) => x.filter((y) => y.id !== f.id)), 1100);
  };
  const patch = (uid: string, fn: (u: UnitView) => Partial<UnitView>) =>
    setUnits((us) => us.map((u) => (u.uid === uid ? { ...u, ...fn(u) } : u)));

  async function play(ev: BattleEvent, list: UnitView[]) {
    switch (ev.type) {
      case 'turn':
        setActive(ev.uid); setLog(`نوبت ${list.find((u) => u.uid === ev.uid)?.side === me ? ctx.profile.name : start.opponent}`); await sleep(350); break;
      case 'attack':
        setAttacking(ev.from); await sleep(260); haptic();
        setAttacking(null); setHit(ev.to);
        patch(ev.to, (u) => ({ shield: u.shield - ev.shieldLost, hp: u.hp - ev.hpLost }));
        float(ev.to, `-${fa(ev.dmg)}`, ev.hpLost === 0 ? 'shieldhit' : 'dmg');
        setLog(`${nameOf(ev.from, list)} ← ${nameOf(ev.to, list)}  ${fa(ev.dmg)} آسیب`);
        await sleep(450); setHit(null); break;
      case 'heal': patch(ev.uid, (u) => ({ hp: Math.min(u.maxHp, u.hp + ev.amount) })); float(ev.uid, `+${fa(ev.amount)}`, 'heal'); await sleep(350); break;
      case 'shield': patch(ev.uid, (u) => ({ shield: u.shield + ev.amount })); float(ev.uid, `🛡+${fa(ev.amount)}`, 'shieldup'); await sleep(350); break;
      case 'death': patch(ev.uid, () => ({ alive: false, hp: 0 })); setLog(`${nameOf(ev.uid, list)} از پا درآمد 💀`); await sleep(500); break;
      case 'revive': patch(ev.uid, () => ({ alive: true, hp: ev.hp })); float(ev.uid, '🔥 زنده شد', 'heal'); setLog(`${nameOf(ev.uid, list)} دوباره زنده شد!`); await sleep(600); break;
      case 'end': break;
    }
  }

  async function pump() {
    if (busy.current) return;
    busy.current = true;
    while (queue.current.length && alive.current) {
      const m = queue.current.shift()!;
      if (m.t === 'events') {
        const list = unitsRef.current;
        for (const ev of m.events) await play(ev, list);
        setUnits((us) => us.map((u) => { const s = m.snap.find((x) => x.uid === u.uid); return s ? { ...u, ...s } : u; }));
        setActive(null);
      } else if (m.t === 'battleEnd') {
        await sleep(300);
        onDone(m);
      }
    }
    busy.current = false;
  }

  useEffect(() => {
    alive.current = true;
    const off = sock.on((m) => {
      if (m.t === 'prompt' && m.battleId === start.battleId) {
        setPrompt({ actor: m.actor, mine: m.mine, attacksLeft: m.attacksLeft, ms: m.remainingMs, at: Date.now() });
        setActive(m.actor);
      } else if ((m.t === 'events' || m.t === 'battleEnd') && m.battleId === start.battleId) {
        if (m.t === 'battleEnd') setPrompt(null);
        queue.current.push(m); void pump();
      } else if (m.t === 'closed') {
        setLog('ارتباط قطع شد');
      }
    });
    return () => { alive.current = false; off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(t); }, []);

  const choose = (uid: string) => {
    if (!prompt?.mine) return;
    const u = units.find((x) => x.uid === uid);
    if (!u || !u.alive || u.side === me) return;
    sock.send({ t: 'target', battleId: start.battleId, uid });
    setPrompt(null);
  };

  const left = prompt?.mine ? Math.max(0, prompt.ms - (now - prompt.at)) : 0;
  const side = (s: Side) => units.filter((u) => u.side === s).sort((a, b) => a.slot - b.slot);
  const enemy = me === 'A' ? 'B' : 'A';

  const tile = (u: UnitView) => {
    const def = cfg.cards.find((c) => c.id === u.cardId)!;
    const targetable = !!prompt?.mine && u.side !== me && u.alive;
    const cls = `bcard ${active === u.uid ? 'active' : ''} ${attacking === u.uid ? (u.side === me ? 'atk-up' : 'atk-down') : ''} ${hit === u.uid ? 'hit' : ''} ${targetable ? 'targetable' : ''}`;
    return (
      <div key={u.uid} className="bcard-wrap">
        <CardTile def={def} level={u.level} maxLevel={cfg.upgrade.maxLevel} hp={Math.max(0, u.hp)} atk={u.atk} shield={u.shield}
          dead={!u.alive} className={cls} onClick={() => choose(u.uid)} disabled={!targetable} />
        <div className="hpbar"><i style={{ width: `${(Math.max(0, u.hp) / u.maxHp) * 100}%` }} /></div>
        {floaters.filter((f) => f.uid === u.uid).map((f) => <span key={f.id} className={`float ${f.cls}`}>{f.text}</span>)}
      </div>
    );
  };

  const reasonText = result?.reason === 'disconnect' ? (result.youWon ? 'حریف قطع شد' : 'ارتباط تو قطع شد') : result?.reason === 'round_cap' ? 'سقف دور‌ها' : '';

  return (
    <div className="battle">
      <div className="opp">{start.opponent} {start.mode === 'pvp' ? '🌐' : '🤖'}</div>
      <div className="row3 enemy">{side(enemy).map(tile)}</div>
      <div className="mid">
        <div className="log">{log}</div>
        {prompt?.mine ? (
          <div className="turnbox">
            <b>هدف را انتخاب کن{prompt.attacksLeft > 1 ? ` (${fa(prompt.attacksLeft)} حمله)` : ''}</b>
            <div className="timer"><i style={{ width: `${(left / prompt.ms) * 100}%` }} /></div>
            <span className="secs num" aria-live="off">{fa(Math.ceil(left / 1000))}</span>
          </div>
        ) : <div className="turnbox idle"><small>{prompt ? 'حریف در حال انتخاب هدف…' : '…'}</small></div>}
      </div>
      <div className="row3 mine">{side(me).map(tile)}</div>

      {result && (
        <Modal>
          <div className="center-in result">
            <h1>{result.youWon ? '🏆 پیروز شدی!' : '💀 باختی'}</h1>
            {reasonText && <small>{reasonText}</small>}
            {result.youWon && <p>{rewardText(result.reward, result.reward?.type ? cfg.box.types[result.reward.type]?.name : undefined)}</p>}
            <button className="btn" onClick={onExit}>بازگشت به منو</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
