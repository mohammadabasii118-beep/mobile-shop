import { useEffect, useMemo, useRef, useState } from 'react';
import { type BattleEvent, type ServerMsg, type Side, type UnitView } from '@game/shared';
import type { Ctx } from './App';
import { onlineRewardLines, rewardText } from './App';
import { CardTile, Icon, Modal, fa } from './ui';
import { haptic, setClosingConfirm } from './telegram';

type Start = Extract<ServerMsg, { t: 'battleStart' }>;
type End = Extract<ServerMsg, { t: 'battleEnd' }>;
export interface BattleInit { start: Start }

interface Floater { id: number; uid: string; text: string; cls: string }
/** افکت‌های بصری روی یک کارت: جرقه‌ی ضربه، یا شکستن کارت موقع مرگ */
interface Fx { id: number; uid: string; kind: 'spark' | 'shatter'; v: { dx: number; dy: number; rot: number; d: number }[] }
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const SHARDS = ['polygon(0 0,52% 0,40% 38%,0 30%)', 'polygon(52% 0,100% 0,100% 34%,40% 38%)', 'polygon(0 30%,40% 38%,34% 72%,0 66%)', 'polygon(40% 38%,100% 34%,100% 70%,34% 72%)', 'polygon(0 66%,34% 72%,48% 100%,0 100%)', 'polygon(34% 72%,100% 70%,100% 100%,48% 100%)'];
const makeFx = (uid: string, kind: Fx['kind']): Fx => ({
  id: ++floaterId, uid, kind,
  v: Array.from({ length: kind === 'spark' ? 9 : SHARDS.length }, () => {
    const a = rnd(-Math.PI, 0);
    return kind === 'spark' ? { dx: Math.cos(a) * rnd(28, 66), dy: Math.sin(a) * rnd(28, 66), rot: 0, d: 0 } : { dx: rnd(-70, 70), dy: rnd(30, 120), rot: rnd(-50, 50), d: rnd(0, 0.06) };
  }),
});

/** افکت برد: پرتو نور و کاغذرنگی */
function WinFx() {
  const bits = useMemo(() => Array.from({ length: 44 }, (_, i) => ({ left: rnd(2, 98), color: ['#ffd76a', '#ffb347', '#fff1b8', '#7fd1ff', '#ff8fa3'][i % 5], dx: rnd(-40, 40), rot: rnd(180, 900), dur: rnd(1.8, 3.4), delay: rnd(0, 1.8) })), []);
  return (
    <>
      <div className="rays" />
      {bits.map((b, i) => <i key={i} className="confetti" style={{ left: `${b.left}%`, background: b.color, ['--dx' as string]: `${b.dx}px`, ['--rot' as string]: `${b.rot}deg`, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }} />)}
    </>
  );
}
/** افکت باخت: گوشه‌های تاریک، باران ریز و جرقه‌ی آتش */
function LoseFx() {
  const rain = useMemo(() => Array.from({ length: 26 }, () => ({ left: rnd(0, 100), dur: rnd(.7, 1.2), delay: rnd(0, 1), o: rnd(.3, .8) })), []);
  const embers = useMemo(() => Array.from({ length: 16 }, () => ({ left: rnd(8, 92), dx: rnd(-30, 30), dur: rnd(2.2, 4), delay: rnd(.2, 2.4) })), []);
  return (
    <>
      <div className="vig" />
      {rain.map((r, i) => <i key={`r${i}`} className="rain" style={{ left: `${r.left}%`, animationDuration: `${r.dur}s`, animationDelay: `${r.delay}s`, opacity: r.o }} />)}
      {embers.map((e, i) => <i key={`e${i}`} className="ember" style={{ left: `${e.left}%`, ['--dx' as string]: `${e.dx}px`, animationDuration: `${e.dur}s`, animationDelay: `${e.delay}s` }} />)}
    </>
  );
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let floaterId = 0;

export function BattleScreen({ ctx, init, onDone, onExit, result }: {
  ctx: Ctx; init: BattleInit; onDone: (e: End) => void; onExit: () => void; result: End | null;
}) {
  const { start } = init;
  const { cfg, sock } = ctx;
  const me: Side = start.you;
  const [units, setUnits] = useState<UnitView[]>(start.units);
  const [prompt, setPrompt] = useState<{ mine: boolean; available: string[]; attacker: string | null; attacksLeft: number; ms: number; at: number } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  /** کشیدن کارت: کارتِ در حال درگ، جای انگشت، و کارت حریفی که زیرش است */
  const [drag, setDrag] = useState<{ uid: string; x: number; y: number; over: string | null } | null>(null);
  const [attacking, setAttacking] = useState<string | null>(null);
  const [hit, setHit] = useState<string | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [fxs, setFxs] = useState<Fx[]>([]);
  const [log, setLog] = useState<string>(`${start.first === me ? 'تو' : start.opponent} شروع می‌کند`);
  const [now, setNow] = useState(Date.now());
  const [chatOpen, setChatOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [bubbles, setBubbles] = useState<{ k: number; text: string; mine: boolean }[]>([]);
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
  const addFx = (uid: string, kind: Fx['kind'], ms: number) => {
    const f = makeFx(uid, kind);
    setFxs((x) => [...x, f]);
    setTimeout(() => setFxs((x) => x.filter((y) => y.id !== f.id)), ms);
  };
  const patch = (uid: string, fn: (u: UnitView) => Partial<UnitView>) =>
    setUnits((us) => us.map((u) => (u.uid === uid ? { ...u, ...fn(u) } : u)));

  async function play(ev: BattleEvent, list: UnitView[]) {
    switch (ev.type) {
      case 'turn':
        setLog(`نوبت ${ev.side === me ? ctx.profile.name : start.opponent}`); break;
      case 'attack':
        setActive(ev.from); setAttacking(ev.from); await sleep(260); haptic();
        setAttacking(null); setHit(ev.to);
        patch(ev.to, (u) => ({ shield: u.shield - ev.shieldLost, hp: u.hp - ev.hpLost }));
        float(ev.to, `-${fa(ev.dmg)}`, ev.hpLost === 0 ? 'shieldhit' : 'dmg'); if (ev.empowered) float(ev.from, '🔥 ۲×', 'heal'); addFx(ev.to, 'spark', 700);
        setLog(`${nameOf(ev.from, list)} ← ${nameOf(ev.to, list)}  ${fa(ev.dmg)} آسیب`);
        await sleep(450); setHit(null); break;
      case 'charge': patch(ev.uid, () => ({ charge: ev.charge, empowered: ev.empowered })); if (ev.empowered) { float(ev.uid, '🔥 قدرت ویژه!', 'heal'); setLog(`${nameOf(ev.uid, list)} آماده‌ی حمله‌ی ۲ برابر است`); await sleep(450); } break;
      case 'heal': patch(ev.uid, (u) => ({ hp: Math.min(u.maxHp, u.hp + ev.amount) })); float(ev.uid, `+${fa(ev.amount)}`, 'heal'); await sleep(350); break;
      case 'shield': patch(ev.uid, (u) => ({ shield: u.shield + ev.amount })); float(ev.uid, `🛡+${fa(ev.amount)}`, 'shieldup'); await sleep(350); break;
      case 'death': addFx(ev.uid, 'shatter', 1150); patch(ev.uid, () => ({ alive: false, hp: 0 })); setLog(`${nameOf(ev.uid, list)} از پا درآمد 💀`); await sleep(500); break;
      case 'revive': patch(ev.uid, () => ({ alive: true, hp: ev.hp })); float(ev.uid, '🔥 زنده شد', 'heal'); setLog(`${nameOf(ev.uid, list)} دوباره زنده شد!`); await sleep(600); break;
      case 'end': break;
    }
  }

  const showBubble = (text: string, mine: boolean) => {
    const b = { k: ++floaterId, text, mine };
    setBubbles((x) => [...x.filter((y) => y.mine !== mine), b]);
    setTimeout(() => setBubbles((x) => x.filter((y) => y.k !== b.k)), 3000);
  };
  const sendChat = (id: number) => { sock.send({ t: 'chat', battleId: start.battleId, id }); showBubble((cfg.chatPhrases ?? [])[id] ?? '', true); setChatOpen(false); };

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

  // تا وقتی نبرد در جریان است، بستن بازی تأیید می‌خواهد
  useEffect(() => { setClosingConfirm(true); return () => setClosingConfirm(false); }, []);
  useEffect(() => { if (result) setClosingConfirm(false); }, [result]);

  useEffect(() => {
    alive.current = true;
    const off = sock.on((m) => {
      if (m.t === 'prompt' && m.battleId === start.battleId) {
        setPrompt({ mine: m.mine, available: m.available, attacker: m.attacker, attacksLeft: m.attacksLeft, ms: m.remainingMs, at: Date.now() });
      } else if ((m.t === 'events' || m.t === 'battleEnd') && m.battleId === start.battleId) {
        if (m.t === 'battleEnd') setPrompt(null);
        queue.current.push(m); void pump();
      } else if (m.t === 'chat' && m.battleId === start.battleId) {
        showBubble(m.text, false);
      } else if (m.t === 'closed') {
        setLog('ارتباط قطع شد');
      }
    });
    return () => { alive.current = false; off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(t); }, []);

  /** کارتِ من می‌تواند الان حمله کند؟ (نوبت من است، کارت آماده است؛ اگر چندحمله‌ای وسط کار است فقط همان کارت) */
  const canDrag = (u: UnitView) => !!prompt?.mine && u.side === me && u.alive && (prompt.attacker ? prompt.attacker === u.uid : prompt.available.includes(u.uid));
  const foeUnder = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-uid]') as HTMLElement | null;
    const uid = el?.dataset.uid;
    const u = uid ? unitsRef.current.find((q) => q.uid === uid) : undefined;
    return u && u.alive && u.side !== me ? u.uid : null;
  };
  const startDrag = (e: React.PointerEvent, u: UnitView) => {
    if (!canDrag(u)) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ uid: u.uid, x: e.clientX, y: e.clientY, over: null });
  };
  const moveDrag = (e: React.PointerEvent) => setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, over: foeUnder(e.clientX, e.clientY) } : d));
  const endDrag = (e: React.PointerEvent, cancel = false) => {
    const d = drag;
    setDrag(null);
    if (!d || cancel || !prompt?.mine) return;
    const to = foeUnder(e.clientX, e.clientY);
    if (to) { sock.send({ t: 'attack', battleId: start.battleId, from: d.uid, uid: to }); setPrompt(null); }
  };

  const left = prompt ? Math.max(0, prompt.ms - (now - prompt.at)) : 0;
  const side = (s: Side) => units.filter((u) => u.side === s).sort((a, b) => a.slot - b.slot);
  const enemy = me === 'A' ? 'B' : 'A';

  const tile = (u: UnitView) => {
    const def = cfg.cards.find((c) => c.id === u.cardId)!;
    const dragging = drag?.uid === u.uid;
    const droptarget = !!drag && drag.over === u.uid;
    const targetable = !!drag && u.side !== me && u.alive;
    const draggable = canDrag(u);
    const resting = u.alive && (u.side === me ? (prompt?.mine ? !prompt.available.includes(u.uid) : u.cooldown > 0) : (!!prompt && !prompt.mine && !prompt.available.includes(u.uid)));
    const shatter = fxs.find((f) => f.uid === u.uid && f.kind === 'shatter');
    const cls = `bcard ${shatter ? 'shatter-hide' : ''} ${active === u.uid ? 'active' : ''} ${draggable ? 'draggable' : ''} ${resting ? 'resting' : ''} ${dragging ? 'dragging' : ''} ${droptarget ? 'droptarget' : ''} ${attacking === u.uid ? (u.side === me ? 'atk-up' : 'atk-down') : ''} ${hit === u.uid ? 'hit' : ''} ${targetable ? 'targetable' : ''}`;
    return (
      <div key={u.uid} data-uid={u.uid} className={`bcard-wrap ${u.empowered && u.alive ? 'empowered' : ''} ${droptarget ? 'over' : ''}`}
        onPointerDown={draggable ? (e) => startDrag(e, u) : undefined} onPointerMove={dragging ? moveDrag : undefined}
        onPointerUp={dragging ? (e) => endDrag(e) : undefined} onPointerCancel={dragging ? (e) => endDrag(e, true) : undefined}>
        <CardTile def={def} level={u.level} maxLevel={cfg.upgrade.maxLevel} hp={Math.max(0, u.hp)} atk={u.atk} shield={u.shield}
          dead={!u.alive} className={cls} hidePips />
        {u.empowered && u.alive && <div className="flame" aria-hidden />}
        {resting && <span className="restb">⏳</span>}
        {shatter && (
          <div className="shards" aria-hidden>
            {shatter.v.map((v, i) => (
              <div key={i} className="shard" style={{ clipPath: SHARDS[i], WebkitClipPath: SHARDS[i], ['--dx' as string]: `${v.dx}px`, ['--dy' as string]: `${v.dy}px`, ['--rot' as string]: `${v.rot}deg`, animationDelay: `${v.d}s` }}>
                <CardTile def={def} level={u.level} maxLevel={cfg.upgrade.maxLevel} hp={0} atk={u.atk} shield={0} />
              </div>
            ))}
          </div>
        )}
        {fxs.filter((f) => f.uid === u.uid && f.kind === 'spark').flatMap((f) => f.v.map((v, i) => (
          <i key={`${f.id}-${i}`} className="spark" style={{ ['--dx' as string]: `${v.dx}px`, ['--dy' as string]: `${v.dy}px` }} />
        )))}
        <div className="hpbar"><i style={{ width: `${(Math.max(0, u.hp) / u.maxHp) * 100}%` }} /></div>
        <div className={`chbar ${u.chargeNeed ? '' : 'none'}`}><i style={{ width: `${u.chargeNeed ? Math.min(100, (u.charge / u.chargeNeed) * 100) : 0}%` }} /></div>
        {floaters.filter((f) => f.uid === u.uid).map((f) => <span key={f.id} className={`float ${f.cls}`}>{f.text}</span>)}
      </div>
    );
  };

  const reasonText = result?.reason === 'left' ? (result.youWon ? 'حریف از بازی خارج شد' : 'از بازی خارج شدی') : result?.reason === 'disconnect' ? (result.youWon ? 'حریف قطع شد' : 'ارتباط تو قطع شد') : result?.reason === 'round_cap' ? 'سقف دور‌ها' : '';

  return (
    <div className={`battle ${result ? (result.youWon ? 'won' : 'lost') : ''}`}>
      <div className="opp">{start.opponent} {start.mode === 'pvp' ? '🌐' : '🤖'}</div>
      <div className="row3 enemy">{side(enemy).map(tile)}</div>
      <div className="mid">
        {bubbles.filter((b) => !b.mine).map((b) => <div key={b.k} className="cbubble cb-foe">{b.text}</div>)}
        <div className="log">{log}</div>
        <small className="hint">{prompt?.mine ? (prompt.attacker ? `حمله‌ی بعدی (${fa(prompt.attacksLeft)} باقی)` : 'کارتت را بکش و روی کارت حریف رها کن') : prompt ? 'حریف در حال انتخاب است…' : ''}</small>
      </div>
      {bubbles.filter((b) => b.mine).map((b) => <div key={b.k} className="cbubble cb-self">{b.text}</div>)}
      <div className="row3 mine">{side(me).map(tile)}</div>

      {!result && (
        <div className="sidetools">
          <button aria-label="خروج" onClick={() => { setConfirmExit(true); setChatOpen(false); }}>🚪</button>
          {start.mode === 'pvp' && <button aria-label="چت" onClick={() => setChatOpen((o) => !o)}>💬</button>}
        </div>
      )}
      {chatOpen && !result && (
        <div className="chatpanel">
          {(cfg.chatPhrases ?? []).map((p, i) => <button key={i} onClick={() => sendChat(i)}>{p}</button>)}
        </div>
      )}
      {confirmExit && !result && (
        <Modal onClose={() => setConfirmExit(false)}>
          <div className="center-in">
            <h3>می‌خوای بازی رو ترک کنی؟</h3>
            <small>اگه بری، حریف برنده می‌شه و تو بازنده حساب می‌شی.</small>
            <div className="row">
              <button className="btn" onClick={() => { sock.send({ t: 'leave', battleId: start.battleId }); setConfirmExit(false); }}>آره، ترک می‌کنم</button>
              <button className="btn ghost" onClick={() => setConfirmExit(false)}>نه، ادامه می‌دم</button>
            </div>
          </div>
        </Modal>
      )}
      {prompt && prompt.ms > 0 && !result && (
        <>
          <div className={`tsecs num ${prompt.mine ? '' : 'foe'}`} aria-live="off">{fa(Math.ceil(left / 1000))}</div>
          <div className={`tline ${prompt.mine ? '' : 'foe'}`}><i style={{ width: `${(left / prompt.ms) * 100}%` }} /></div>
        </>
      )}
      {drag && (() => {
        const u = units.find((x) => x.uid === drag.uid)!;
        const def = cfg.cards.find((c) => c.id === u.cardId)!;
        return <div className={`dragghost ${drag.over ? 'over' : ''}`} style={{ left: drag.x, top: drag.y }}><CardTile def={def} level={u.level} maxLevel={cfg.upgrade.maxLevel} hp={Math.max(0, u.hp)} atk={u.atk} shield={u.shield} hidePips /></div>;
      })()}

      {result && (
        <div className={`overlay res ${result.youWon ? 'win' : 'lose'}`}>
          {result.youWon ? <WinFx /> : <LoseFx />}
          <div className="sheet">
            <div className="center-in result">
              <h1>{result.youWon ? '🏆 پیروز شدی!' : '💀 باختی'}</h1>
              {reasonText && <small>{reasonText}</small>}
              {result.reward?.coins ? <p className="rwline"><span className="coinv"><Icon n="coin" /> +{fa(result.reward.coins)}</span> سکه</p> : null}
              {onlineRewardLines(result.reward).map((l) => <p key={l} className="rwline">{l}</p>)}
              {result.friendly && <p>بازی دوستانه بود؛ جایزه‌ای ندارد 🤝</p>}
              {result.youWon && !result.friendly && <p>{rewardText(result.reward, result.reward?.type ? cfg.box.types[result.reward.type]?.name : undefined)}</p>}
              <button className="btn" onClick={onExit}>بازگشت به منو</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
