import { useEffect, useMemo, useRef, useState } from 'react';
import type { BattleEvent, ServerMsg, Side, UnitView } from '@game/shared';
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
  const [prompt, setPrompt] = useState<{ actor: string; mine: boolean; attacksLeft: number; ms: number; at: number } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [attacking, setAttacking] = useState<string | null>(null);
  const [hit, setHit] = useState<string | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [fxs, setFxs] = useState<Fx[]>([]);
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
        setActive(ev.uid); setLog(`نوبت ${list.find((u) => u.uid === ev.uid)?.side === me ? ctx.profile.name : start.opponent}`); await sleep(350); break;
      case 'attack':
        setAttacking(ev.from); await sleep(260); haptic();
        setAttacking(null); setHit(ev.to);
        patch(ev.to, (u) => ({ shield: u.shield - ev.shieldLost, hp: u.hp - ev.hpLost }));
        float(ev.to, `-${fa(ev.dmg)}`, ev.hpLost === 0 ? 'shieldhit' : 'dmg'); addFx(ev.to, 'spark', 700);
        setLog(`${nameOf(ev.from, list)} ← ${nameOf(ev.to, list)}  ${fa(ev.dmg)} آسیب`);
        await sleep(450); setHit(null); break;
      case 'heal': patch(ev.uid, (u) => ({ hp: Math.min(u.maxHp, u.hp + ev.amount) })); float(ev.uid, `+${fa(ev.amount)}`, 'heal'); await sleep(350); break;
      case 'shield': patch(ev.uid, (u) => ({ shield: u.shield + ev.amount })); float(ev.uid, `🛡+${fa(ev.amount)}`, 'shieldup'); await sleep(350); break;
      case 'death': addFx(ev.uid, 'shatter', 1150); patch(ev.uid, () => ({ alive: false, hp: 0 })); setLog(`${nameOf(ev.uid, list)} از پا درآمد 💀`); await sleep(500); break;
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

  // تا وقتی نبرد در جریان است، بستن بازی تأیید می‌خواهد
  useEffect(() => { setClosingConfirm(true); return () => setClosingConfirm(false); }, []);
  useEffect(() => { if (result) setClosingConfirm(false); }, [result]);

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
    const shatter = fxs.find((f) => f.uid === u.uid && f.kind === 'shatter');
    const cls = `bcard ${shatter ? 'shatter-hide' : ''} ${active === u.uid ? 'active' : ''} ${attacking === u.uid ? (u.side === me ? 'atk-up' : 'atk-down') : ''} ${hit === u.uid ? 'hit' : ''} ${targetable ? 'targetable' : ''}`;
    return (
      <div key={u.uid} className="bcard-wrap">
        <CardTile def={def} level={u.level} maxLevel={cfg.upgrade.maxLevel} hp={Math.max(0, u.hp)} atk={u.atk} shield={u.shield}
          dead={!u.alive} className={cls} onClick={() => choose(u.uid)} disabled={!targetable} />
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
        {floaters.filter((f) => f.uid === u.uid).map((f) => <span key={f.id} className={`float ${f.cls}`}>{f.text}</span>)}
      </div>
    );
  };

  const reasonText = result?.reason === 'disconnect' ? (result.youWon ? 'حریف قطع شد' : 'ارتباط تو قطع شد') : result?.reason === 'round_cap' ? 'سقف دور‌ها' : '';

  return (
    <div className={`battle ${result ? (result.youWon ? 'won' : 'lost') : ''}`}>
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
        <div className={`overlay res ${result.youWon ? 'win' : 'lose'}`}>
          {result.youWon ? <WinFx /> : <LoseFx />}
          <div className="sheet">
            <div className="center-in result">
              <h1>{result.youWon ? '🏆 پیروز شدی!' : '💀 باختی'}</h1>
              {reasonText && <small>{reasonText}</small>}
              {result.reward?.coins ? <p className="rwline"><span className="coinv"><Icon n="coin" /> +{fa(result.reward.coins)}</span> سکه</p> : null}
              {onlineRewardLines(result.reward).map((l) => <p key={l} className="rwline">{l}</p>)}
              {result.youWon && <p>{rewardText(result.reward, result.reward?.type ? cfg.box.types[result.reward.type]?.name : undefined)}</p>}
              <button className="btn" onClick={onExit}>بازگشت به منو</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
