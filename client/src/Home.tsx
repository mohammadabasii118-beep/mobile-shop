import { useEffect, useState } from 'react';
import type { Ctx } from './App';
import { call } from './net';
import { isDev } from './telegram';
import { Bar, Modal, fa, fmtTime, CardTile, RARITY_FA, Icon } from './ui';

export function Home({ ctx, queued, onAdmin }: { ctx: Ctx; queued: boolean; onAdmin: () => void }) {
  const { profile: p, cfg, sock } = ctx;
  const [view, setView] = useState<'menu' | 'solo'>('menu');
  const [showProfile, setShowProfile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState<'about' | 'news' | null>(null);

  return (
    <>
      <header className="top">
        <button className={`menubtn ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen((o) => !o)} aria-label="منو" aria-expanded={menuOpen}>
          <i /><i /><i />
        </button>
        <div className="coins"><Icon n="coin" /> {fa(p.coins)}</div>
        <button className="me" onClick={() => setShowProfile(true)} aria-label="پروفایل">
          <span className="av">
            <Avatar url={p.avatar} name={p.name} />
            <b className="lvbadge">{fa(p.level)}</b>
          </span>
          <span className="meinfo">
            <b className="pname">{p.name}</b>
            <span className="lvline">لول {fa(p.level)} <small>{fa(Math.max(0, p.xpNeeded - p.xp))} تا لول بعد</small></span>
            <span className="xpbar" role="progressbar" aria-valuenow={p.xp} aria-valuemax={p.xpNeeded}>
              <i style={{ width: `${Math.min(100, (p.xp / p.xpNeeded) * 100)}%` }} />
              <span className="num" dir="ltr">{fa(p.xp)} / {fa(p.xpNeeded)} XP</span>
            </span>
          </span>
        </button>
      </header>

      {menuOpen && (
        <>
          <div className="gmenu-bg" onClick={() => setMenuOpen(false)} />
          <nav className="gmenu" aria-label="منوی بازی">
            <button onClick={() => { setMenuOpen(false); setShowProfile(true); }}>
              <svg className="i" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.400 3.600-7 8-7s8 2.600 8 7" /></svg><span>پروفایل</span><em>‹</em>
            </button>
            <button onClick={() => { setMenuOpen(false); setPage('about'); }}>
              <svg className="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.500h.01" /></svg><span>درباره</span><em>‹</em>
            </button>
            <button onClick={() => { setMenuOpen(false); setPage('news'); }}>
              <svg className="i" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h8M8 17h4" /></svg><span>خبرگزاری</span><b className="soon">به‌زودی</b><em>‹</em>
            </button>
            {p.isAdmin && (
              <button onClick={() => { setMenuOpen(false); onAdmin(); }}>
                <svg className="i" viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.500-3 8-7 10-4-2-7-5.500-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg><span>پنل مدیریت</span><em>‹</em>
              </button>
            )}
          </nav>
        </>
      )}

      {view === 'menu' ? (
        <section className="menu">
          <div className="hero">
            {cfg.ui?.banner ? <img className="bannerimg" src={cfg.ui.banner} alt="میراث" /> : <><div className="brand">میراث</div><p>سه کارت، یک میراث</p></>}
          </div>
          <button className="mode solo" onClick={() => setView('solo')}>
            <span className="ico"><svg className="i" viewBox="0 0 24 24"><rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 16h6"/></svg></span><div><b>سولو</b></div><FeePill n={cfg.fees?.solo} />
          </button>
          <button className="mode multi" disabled={queued} onClick={() => sock.send({ t: 'queue' })}>
            <span className="ico"><svg className="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg></span><div><b>مولتی‌پلیر</b></div><FeePill n={cfg.fees?.multi} />
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
                  <span className="stagend">{!locked && <FeePill n={cfg.fees?.solo} small />}{locked ? '🔒' : done ? '✅' : '▶'}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <Boxes ctx={ctx} />

      {showProfile && <ProfileModal ctx={ctx} onClose={() => setShowProfile(false)} />}
      {page === 'about' && (
        <Modal onClose={() => setPage(null)}>
          <div className="center-in">
            <div className="brand" style={{ fontSize: 40 }}>میراث</div>
            <p>بازی کارتی نوبتی ۳ به ۳. سه کارت انتخاب کن، با ربات یا بازیکن‌های دیگر نبرد کن، جعبه بگیر و کارت‌هایت را قوی‌تر کن.</p>
            <small>نسخه‌ی آزمایشی ۰٫۱</small>
            <button className="btn" onClick={() => setPage(null)}>بستن</button>
          </div>
        </Modal>
      )}
      {page === 'news' && (
        <Modal onClose={() => setPage(null)}>
          <div className="center-in">
            <h3 style={{ fontFamily: 'var(--f-display)', fontWeight: 400, fontSize: 24 }}>خبرگزاری</h3>
            <div className="soonbox">به‌زودی</div>
            <small>اخبار و رویدادهای بازی اینجا منتشر می‌شود.</small>
            <button className="btn" onClick={() => setPage(null)}>بستن</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** هزینه‌ی ورود (سکه) */
function FeePill({ n, small }: { n?: number; small?: boolean }) {
  if (!n) return null;
  return <span className={`fee ${small ? 'sm' : ''}`}><Icon n="coin" /> {fa(n)}</span>;
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
