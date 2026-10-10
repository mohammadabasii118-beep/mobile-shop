import {
  attack, createBattle, getUnit, aliveUnits, other, pickTarget, snapshot, startNextTurn,
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

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** یک مبارزه‌ی کامل. منطق از engine مشترک می‌آید؛ اینجا فقط نوبت‌دهی، تایمر و ارتباط است. */
export class Battle {
  readonly state: BattleState;
  private parts: Record<Side, Participant>;
  private ended = false;
  private pending: { part: Participant; resolve: (uid: string) => void; timer: NodeJS.Timeout } | null = null;
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
      hp: u.hp, maxHp: u.maxHp, shield: u.shield, atk: u.atk, alive: u.alive, ability: u.ability?.id ?? null, level: u.level ?? 1,
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
      const actor = getUnit(this.state, this.state.current!.uid)!;
      const part = this.parts[actor.side];
      while (this.state.current && !this.state.over && !this.ended) {
        for (const p of this.humans()) {
          p.send!({
            t: 'prompt', battleId: this.id, actor: actor.uid, attacksLeft: this.state.current.attacksLeft,
            remainingMs: part.send ? this.o.turnMs : 0, mine: p === part,
          });
        }
        const target = await this.chooseTarget(part);
        if (this.ended) return;
        this.broadcast(attack(this.state, target));
        await sleep(this.o.pauseMs);
      }
    }
    if (this.ended) return;
    this.ended = true;
    const reason = this.state.winner && aliveUnits(this.state, other(this.state.winner)).length === 0 ? 'kills' : 'round_cap';
    this.o.onEnd({ winner: this.state.winner!, reason, forfeit: null });
  }

  private chooseTarget(part: Participant): Promise<string> {
    const foes = () => aliveUnits(this.state, other(part.side));
    if (!part.send) {
      return sleep(this.o.botDelayMs).then(() => pickTarget(this.state, part.side, part.ai ?? 'random', this.o.rng));
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        // وقت تموم شد → هدف رندوم
        this.pending = null;
        const f = foes();
        resolve(f[Math.floor(this.o.rng() * f.length)].uid);
      }, this.o.turnMs);
      this.pending = { part, resolve, timer };
    });
  }

  /** انتخاب هدف از سمت بازیکن (کاملاً اعتبارسنجی می‌شود) */
  handleTarget(userId: number, uid: string) {
    const p = this.pending;
    if (!p || p.part.userId !== userId) return;
    const t = getUnit(this.state, uid);
    if (!t || !t.alive || t.side === p.part.side) return;
    clearTimeout(p.timer);
    this.pending = null;
    p.resolve(uid);
  }

  /** قطع اتصال یا خروج: همون لحظه می‌بازه */
  forfeit(side: Side) {
    if (this.ended) return;
    this.ended = true;
    if (this.pending) { clearTimeout(this.pending.timer); this.pending = null; }
    this.o.onEnd({ winner: other(side), reason: 'disconnect', forfeit: side });
  }
}
