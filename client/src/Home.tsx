import { useEffect, useState } from 'react';
import type { Ctx } from './App';
import { call } from './net';
import { isDev } from './telegram';
import { Bar, Modal, fa, fmtTime, CardTile, RARITY_FA } from './ui';

export function Home({ ctx, queued, setQueued }: { ctx: Ctx; queued: boolean; setQueued: (b: boolean) => void }) {
  const { profile: p, cfg, sock } = ctx;
  const [view, setView] = useState<'menu' | 'solo'>('menu');
  const [showProfile, setShowProfile] = useState(false);

  return (
    <>
      <header className="top">
        <button className="me" onClick={() => setShowProfile(true)}>
          <Avatar url={p.avatar} name={p.name} />
          <div className="meinfo">
            <b>{p.name}</b>
            <div className="lv">لول {fa(p.level)}</div>
            <Bar value={p.xp} max={p.xpNeeded} color="var(--xp)" />
          </div>
        </button>
        <div className="coins">🪙 {fa(p.coins)}</div>
        <button className="gear" onClick={() => setShowProfile(true)} aria-label="تنظیمات">⚙️</button>
      </header>

      {view === 'menu' ? (
        <section className="menu">
          <h2>منوی بازی</h2>
          <button className="mode solo" onClick={() => setView('solo')}>
            <span className="ico">🤖</span><div><b>سولو</b><small>مرحله‌های متوالی در برابر ربات</small></div>
          </button>
          <button className="mode multi" disabled={queued} onClick={() => sock.send({ t: 'queue' })}>
            <span className="ico">🌐</span><div><b>مولتی‌پلیر</b><small>نبرد آنلاین با بازیکن واقعی</small></div>
          </button>
        </section>
      ) : (
        <section className="menu">
          <h2><button className="back" onClick={() => setView('menu')}>→</button> مرحله‌های سولو</h2>
          <div className="stages">
            {cfg.solo.stages.map((st, i) => {
              const locked = i > p.soloStage, done = i < p.soloStage;
              return (
                <button key={i} className={`stage ${locked ? 'locked' : ''} ${done ? 'done' : ''}`} disabled={locked}
                  onClick={() => sock.send({ t: 'solo', stage: i })}>
                  <b>{st.name}</b>
                  <span>{locked ? '🔒' : done ? '✅' : '▶'}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <Boxes ctx={ctx} />

      {showProfile && <ProfileModal ctx={ctx} onClose={() => setShowProfile(false)} />}
      {queued && null}
    </>
  );
}

function Avatar({ url, name, big }: { url: string | null; name: string; big?: boolean }) {
  const [bad, setBad] = useState(false);
  return url && !bad
    ? <img className={`avatar ${big ? 'big' : ''}`} src={url} alt="" onError={() => setBad(true)} />
    : <div className={`avatar ph ${big ? 'big' : ''}`}>{name.slice(0, 1)}</div>;
}

function ProfileModal({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const p = ctx.profile;
  const total = p.wins + p.losses;
  return (
    <Modal onClose={onClose}>
      <div className="profile">
        <Avatar url={p.avatar} name={p.name} big />
        <h3>{p.name}</h3>
        <div>لول {fa(p.level)} — {fa(p.xp)} / {fa(p.xpNeeded)} XP</div>
        <Bar value={p.xp} max={p.xpNeeded} color="var(--xp)" />
        <div className="grid3">
          <div><b>{fa(p.wins)}</b><small>برد</small></div>
          <div><b>{fa(p.losses)}</b><small>باخت</small></div>
          <div><b>{total ? fa(Math.round((p.wins / total) * 100)) + '٪' : '—'}</b><small>درصد برد</small></div>
        </div>
        <button className="btn" onClick={onClose}>بستن</button>
      </div>
    </Modal>
  );
}

function Boxes({ ctx }: { ctx: Ctx }) {
  const { profile: p, cfg, setProfile, toast } = ctx;
  const [, tick] = useState(0);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [reward, setReward] = useState<any>(null);
  useEffect(() => { setFetchedAt(Date.now()); }, [p]);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const act = async (path: string, slot: number) => {
    try {
      const j = await call(path, { slot });
      setProfile(j.profile);
      if (j.reward) setReward(j.reward);
    } catch (e) { toast((e as Error).message); }
  };
  const bySlot = new Map(p.boxes.map((b) => [b.slot, b]));
  const anyOpening = p.boxes.some((b) => b.state === 'opening');
  return (
    <section className="boxes">
      <h3>جعبه‌ها</h3>
      <div className="slots">
        {Array.from({ length: cfg.box.slots }, (_, i) => {
          const b = bySlot.get(i);
          if (!b) return <div key={i} className="slot empty">خالی</div>;
          const left = b.state === 'opening' ? Math.max(0, b.remainingMs - (Date.now() - fetchedAt)) : 0;
          if (b.state === 'locked') return (
            <button key={i} className="slot" disabled={anyOpening} onClick={() => act('/api/box/start', i)}>
              <span className="ico">🎁</span><small>{anyOpening ? 'در صف' : 'شروع باز شدن'}</small><small>{fmtTime(b.remainingMs)}</small>
            </button>);
          if (b.state === 'ready' || left === 0) return (
            <button key={i} className="slot ready" onClick={() => act('/api/box/open', i)}>
              <span className="ico">✨</span><small>باز کن!</small>
            </button>);
          return (
            <div key={i} className="slot opening">
              <span className="ico">⏳</span><small>{fmtTime(left)}</small>
              {isDev && <button className="mini" onClick={() => act('/api/box/skip', i)}>⏩ دمو</button>}
            </div>);
        })}
      </div>
      {reward && (
        <Modal onClose={() => setReward(null)}>
          <div className="center-in">
            <h3>🎉 جعبه باز شد</h3>
            <p>🪙 {fa(reward.coins)} سکه</p>
            <p>⭐ {fa(reward.xp)} XP {reward.levelsGained ? `— لول‌آپ! (+${fa(reward.levelsGained)})` : ''}</p>
            {reward.cards.length === 0 && <p>این بار کارتی نیامد</p>}
            <div className="row">
              {reward.cards.map((c: { id: string; isNew: boolean }) => {
                const def = cfg.cards.find((x) => x.id === c.id)!;
                return <CardTile key={c.id} small def={def} level={1} hp={def.hp} atk={def.atk} shield={def.shield}
                  badge={<div className="newb">{c.isNew ? 'جدید!' : `تکراری (${RARITY_FA[def.rarity]})`}</div>} />;
              })}
            </div>
            <button className="btn" onClick={() => setReward(null)}>عالی</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
