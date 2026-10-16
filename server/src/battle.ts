import {
  attack, createBattle, isValidTarget, getUnit, aliveUnits, other, pickAttacker, pickTarget, snapshot, startNextTurn,
  type BattleEvent, type BattleState, type GameConfig, type ServerMsg, type Side, type UnitInit, type UnitView,
} from '@game/shared';

export interface Participant {
  side: Side;
  name: string;
  userId: number | null; // null = ربات
  send: ((m: ServerMsg) => void) | null;
  ai?: 'random' | 'smart';
  units: UnitInit[];
}

export interface BattleOpts {
  id: string;
  mode: 'solo' | 'pvp';
  cfg: GameConfig;
  rng: () => number;
  turnMs: number;      // مهلت انتخاب هدف (سمت سرور)
  pauseMs: number;     // مکث بین حمله‌ها برای انیمیشن کلاینت
  botDelayMs: number;
  onEnd: (r: { winner: Side; reason: string; forfeit: Side | null }) => void;
}

type Choice = { from: string; to: string };
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** یک مبارزه‌ی کامل. منطق از engine مشترک می‌آید؛ اینجا فقط نوبت‌دهی، تایمر و ارتباط است. */
export class Battle {
  readonly state: BattleState;
  private parts: Record<Side, Participant>;
  private ended = false;
  private pending: { part: Participant; resolve: (c: Choice) => void; timer: NodeJS.Timeout } | null = null;
  readonly first: Side;

  constructor(private o: BattleOpts, a: Participant, b: Participant) {
    this.parts = { A: a, B: b };
    this.first = o.rng() < 0.5 ? 'A' : 'B';
    this.state = createBattle({ A: a.units, B: b.units }, this.first, o.cfg.maxRounds);
  }

  get id() { return this.o.id; }
  sideOf(userId: number): Side | null {
    return (['A', 'B'] as Side[]).find((s) => this.parts[s].userId === userId) ?? null;
  }

  private humans() { return (['A', 'B'] as Side[]).map((s) => this.parts[s]).filter((p) => p.send); }
  private broadcast(events: BattleEvent[]) {
    if (!events.length) return;
    const msg: ServerMsg = { t: 'events', battleId: this.id, events, snap: snapshot(this.state) };
    for (const p of this.humans()) p.send!(msg);
  }

  private views(): UnitView[] {
    return this.state.units.map((u) => ({
      uid: u.uid, side: u.side, slot: u.slot, cardId: u.cardId, name: u.name,
      rarity: this.o.cfg.cards.find((c) => c.id === u.cardId)?.rarity ?? null,
      hp: u.hp, maxHp: u.maxHp, shield: u.shield, atk: u.atk, alive: u.alive, abilities: (u.abilities ?? []).map((a) => a.id), level: u.level ?? 1,
      charge: u.charge, chargeNeed: u.chargeAttacks ?? 0, empowered: u.empowered, cooldown: u.cooldown, poison: u.poison?.left ?? 0,
    }));
  }

  async run() {
    for (const p of this.humans()) {
      p.send!({
        t: 'battleStart', battleId: this.id, you: p.side, units: this.views(), mode: this.o.mode,
        opponent: this.parts[other(p.side)].name, first: this.first,
      });
    }
    await sleep(this.o.pauseMs);
    while (!this.state.over && !this.ended) {
      this.broadcast(startNextTurn(this.state));
      if (this.state.over) break;
      const cur = () => this.state.current!;
      const part = this.parts[cur().side];
      while (this.state.current && !this.state.over && !this.ended) {
        for (const p of this.humans()) {
          p.send!({
            t: 'prompt', battleId: this.id, mine: p === part, available: cur().available, attacker: cur().uid,
            attacksLeft: cur().attacksLeft, remainingMs: part.send ? this.o.turnMs : 0,
          });
        }
        const c = await this.choose(part);
        if (this.ended) return;
        this.broadcast(attack(this.state, c.from, c.to, this.o.rng));
        await sleep(this.o.pauseMs);
      }
    }
    if (this.ended) return;
    this.ended = true;
    const reason = this.state.winner && aliveUnits(this.state, other(this.state.winner)).length === 0 ? 'kills' : 'round_cap';
    this.o.onEnd({ winner: this.state.winner!, reason, forfeit: null });
  }

  /** کارتِ حمله‌کننده (اگر قبلاً انتخاب نشده) و هدف را از بازیکن می‌گیرد؛ ربات سریع، و با اتمام وقت رندوم */
  private choose(part: Participant): Promise<Choice> {
    const auto = (mode: 'random' | 'smart'): Choice => {
      const from = pickAttacker(this.state, mode, this.o.rng);
      return { from, to: pickTarget(this.state, part.side, mode, this.o.rng, from) };
    };
    if (!part.send) return sleep(this.o.botDelayMs).then(() => auto(part.ai ?? 'random'));
    return new Promise((resolve) => {
      const timer = setTimeout(() => { this.pending = null; resolve(auto('random')); }, this.o.turnMs);
      this.pending = { part, resolve, timer };
    });
  }

  /** حمله از سمت بازیکن: from = کارت خودش، uid = کارت حریف (کاملاً اعتبارسنجی می‌شود) */
  handleTarget(userId: number, from: string, uid: string) {
    const p = this.pending;
    const cur = this.state.current;
    if (!p || !cur || p.part.userId !== userId) return;
    const f = getUnit(this.state, from);
    const t = getUnit(this.state, uid);
    if (!f || !f.alive || f.side !== p.part.side) return;
    if (cur.uid ? cur.uid !== from : !cur.available.includes(from)) return;
    if (!t || !isValidTarget(this.state, from, uid)) return;
    clearTimeout(p.timer);
    this.pending = null;
    p.resolve({ from, to: uid });
  }

  /** چت آماده: فقط آنلاین، حداکثر یک پیام در هر ثانیه؛ برای حریف فرستاده می‌شود */
  private lastChat = 0;
  chat(userId: number, id: number) {
    const side = this.sideOf(userId);
    if (!side || this.o.mode !== 'pvp' || this.ended || !Number.isInteger(id) || id < 0 || id >= (this.o.cfg.chatPhrases ?? []).length) return;
    const now = Date.now();
    if (now - this.lastChat < 1000) return;
    this.lastChat = now;
    this.parts[other(side)].send?.({ t: 'chat', battleId: this.id, id, text: this.o.cfg.chatPhrases![id] });
  }

  /** قطع اتصال یا خروج: همون لحظه می‌بازه */
  forfeit(side: Side, reason = 'disconnect') {
    if (this.ended) return;
    this.ended = true;
    if (this.pending) { clearTimeout(this.pending.timer); this.pending = null; }
    this.o.onEnd({ winner: other(side), reason, forfeit: side });
  }
}
