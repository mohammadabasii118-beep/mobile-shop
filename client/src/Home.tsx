import { useEffect, useState } from 'react';
import type { Ctx } from './App';
import { call } from './net';
import { isDev, openLink } from './telegram';
import { setMuted, setVolume, useMusic, type Channel } from './music';
import { Bar, Modal, fa, fmtTime, CardTile, RARITY_FA, Icon } from './ui';

export function Home({ ctx, queued, onAdmin }: { ctx: Ctx; queued: boolean; onAdmin: () => void }) {
  const { profile: p, cfg, sock } = ctx;
  const [view, setView] = useState<'menu' | 'solo'>('menu');
  // گودال‌ها با اندیس اولین لولشان در ترتیب کلی (برای باز و قفل بودن)
  const pits = cfg.solo.pits.reduce<{ stages: unknown[]; first: number }[]>((acc, pit) => {
    const first = acc.length ? acc[acc.length - 1].first + acc[acc.length - 1].stages.length : 0;
    return [...acc, { stages: pit.stages, first }];
  }, []);
  const [pitIdx, setPitIdx] = useState(() => Math.max(0, pits.findIndex((q) => q.first + q.stages.length > ctx.profile.soloStage)));
  const [showProfile, setShowProfile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState<'about' | 'news' | 'settings' | null>(null);

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
            <button onClick={() => { setMenuOpen(false); setPage('settings'); }}>
              <svg className="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.600 5.600l2.100 2.100M16.300 16.300l2.100 2.100M18.400 5.600l-2.100 2.100M7.700 16.300l-2.100 2.100" /></svg><span>تنظیمات</span><em>‹</em>
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
            <span className="medal8"><svg className="i" viewBox="0 0 24 24"><rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 16h6"/></svg></span>
            <span className="mtitle">سولو</span><FeePill n={cfg.fees?.solo} />
          </button>
          <button className="mode multi" disabled={queued} onClick={() => sock.send({ t: 'queue' })}>
            <span className="medal8"><svg className="i" viewBox="0 0 24 24"><path d="M4 4l9 9M9 4H4v5M20 4l-9 9M15 4h5v5M7 17l-3 3M17 17l3 3"/></svg></span>
            <span className="mtitle">مولتی‌پلیر</span><FeePill n={cfg.fees?.multi} />
          </button>
        </section>
      ) : (
        <section className="menu">
          <h2><button className="back" onClick={() => setView('menu')}>→</button> سولو <FeePill n={cfg.fees?.solo} small /></h2>
          <div className="pits" role="tablist" aria-label="گودال‌ها">
            {pits.map((pit, pi) => (
              <button key={pi} role="tab" aria-selected={pi === pitIdx} className={`pit ${pits[pi].first > p.soloStage ? 'locked' : ''}`}
                disabled={pits[pi].first > p.soloStage} onClick={() => setPitIdx(pi)}>
                {pits[pi].first > p.soloStage ? '🔒 ' : ''}گودال {fa(pi + 1)}
              </button>
            ))}
          </div>
          <div className="levels">
            {pits[pitIdx].stages.map((_, li) => {
              const g = pits[pitIdx].first + li;
              const locked = g > p.soloStage, done = g < p.soloStage, cur = g === p.soloStage;
              return (
                <button key={li} className={`lvl ${locked ? 'locked' : ''} ${done ? 'done' : ''} ${cur ? 'cur' : ''}`} disabled={locked}
                  onClick={() => sock.send({ t: 'solo', stage: g })} aria-label={`لول ${li + 1}`}>
                  <small>لول</small>
                  <b className="num">{fa(li + 1)}</b>
                  <span>{locked ? '🔒' : done ? '✅' : '▶'}</span>
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
          <div className="about">
            <h3>میراث، نسخه‌ی آزمایشی 0.0.1</h3>
            <p>بازی کارتی دوئلی با کارت‌های اساطیری. سه کارت می‌چینی، هدف رو خودت انتخاب می‌کنی و حریف رو شکست می‌دی.</p>
            <div className="links">
              <span>✅ کانال رسمی:</span>
              <TgLink id="MirasGame" />
              <span>✅ پشتیبانی و گزارش باگ:</span>
              <TgLink id="BHK_Su" />
              <TgLink id="Mhmdabasiiii" />
            </div>
            <button className="btn" onClick={() => setPage(null)}>بستن</button>
          </div>
        </Modal>
      )}
      {page === 'settings' && (
        <Modal onClose={() => setPage(null)}>
          <div className="settings">
            <h3>تنظیمات</h3>
            <VolumeRow ch="menu" label="🎵 موسیقی بازی" />
            <VolumeRow ch="battle" label="⚔️ صدای نبرد (سولو و آنلاین)" />
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

/** جعبه‌ی گنج؛ رنگش از متغیرهای CSS نوع جعبه (برنزی/نقره‌ای/طلایی) می‌آید */
function Chest() {
  return (
    <svg className="chest" viewBox="0 0 48 42" aria-hidden="true">
      <ellipse cx="24" cy="39" rx="19" ry="2.6" fill="rgba(0,0,0,.45)" />
      <rect x="4" y="19" width="40" height="19" rx="3" style={{ fill: 'var(--ch2)' }} />
      <path d="M4 21C4 9 12 4 24 4s20 5 20 17z" style={{ fill: 'var(--ch1)' }} />
      <rect x="4" y="18" width="40" height="5" style={{ fill: 'var(--ch3)' }} />
      <path d="M9 21C9 12 15 8 24 8" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="2" strokeLinecap="round" />
      <rect x="19.500" y="17" width="9" height="12" rx="2" style={{ fill: 'var(--lk)' }} stroke="rgba(0,0,0,.45)" />
      <circle cx="24" cy="22.500" r="2" fill="#3a2406" />
      <rect x="23.200" y="23" width="1.600" height="3.600" fill="#3a2406" />
    </svg>
  );
}

/** لینک آیدی تلگرام (باز شدن داخل تلگرام) */
function TgLink({ id }: { id: string }) {
  return <a className="tglink" dir="ltr" href={`https://t.me/${id}`} onClick={(e) => { e.preventDefault(); openLink(`https://t.me/${id}`); }}>@{id}</a>;
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
          if (!b) return <div key={i} className="slot empty"><span>خالی</span></div>;
          const left = b.state === 'opening' ? Math.max(0, b.remainingMs - (Date.now() - fetchedAt)) : 0;
          const label = <b className={`btype ${b.type}`}>{cfg.box.types[b.type]?.name ?? b.type}</b>;
          if (b.state === 'locked') return (
            <button key={i} className={`slot bx ${b.type}`} disabled={anyOpening} onClick={() => act('/api/box/start', i)}>
              {label}<Chest /><small>{anyOpening ? 'در صف' : 'شروع باز شدن'}</small><small>{fmtTime(b.remainingMs)}</small>
            </button>);
          if (b.state === 'ready' || left === 0) return (
            <button key={i} className={`slot bx ready ${b.type}`} onClick={() => act('/api/box/open', i)}>
              {label}<Chest /><small>باز کن!</small>
            </button>);
          return (
            <div key={i} className={`slot bx opening ${b.type}`}>
              {label}<Chest /><small>{fmtTime(left)}</small>
              {isDev && <button className="mini" onClick={() => act('/api/box/skip', i)}>⏩ دمو</button>}
            </div>);
        })}
      </div>
      {reward && (
        <Modal onClose={() => setReward(null)}>
          <div className="center-in">
            <h3>🎉 جعبه‌ی {cfg.box.types[reward.type as 'bronze']?.name} باز شد</h3>
            <p>🪙 {fa(reward.coins)} سکه</p>
            <p>⭐ {fa(reward.xp)} XP {reward.levelsGained ? `— لول‌آپ! (+${fa(reward.levelsGained)})` : ''}</p>
            {reward.cards.length === 0 && <p>این بار کارتی نیامد</p>}
            <div className="row">
              {reward.cards.map((c: { id: string; isNew: boolean }) => {
                const def = cfg.cards.find((x) => x.id === c.id)!;
                return <CardTile key={c.id} small def={def} level={1} hp={def.hp} atk={def.atk} shield={def.shield}
                  badge={<div className="newb">{c.isNew ? 'جدید!' : `+۱ تعداد کارت`}</div>} />;
              })}
            </div>
            <button className="btn" onClick={() => setReward(null)}>عالی</button>
          </div>
        </Modal>
      )}
    </section>
  );
}

/** یک ردیف تنظیم صدا: کلید روشن/خاموش + نوار صدا از ۰ تا ۱۰۰ */
function VolumeRow({ ch, label }: { ch: Channel; label: string }) {
  const m = useMusic(ch);
  const off = m.muted || m.volume === 0;
  return (
    <div className="vrow">
      <div className="srow">
        <span>{label}</span>
        <button className={`switch ${off ? '' : 'on'}`} role="switch" aria-checked={!off} aria-label={`روشن/خاموش ${label}`}
          onClick={() => (m.volume === 0 ? setVolume(ch, 0.5) : setMuted(ch, !m.muted))}><i /></button>
      </div>
      <div className="srow vol">
        <span>🔈</span>
        <input type="range" min={0} max={100} step={1} dir="ltr" value={m.muted ? 0 : Math.round(m.volume * 100)} onChange={(e) => setVolume(ch, Number(e.target.value) / 100)} aria-label={`بلندی ${label}`} />
        <span>🔊</span>
        <b className="num">{fa(m.muted ? 0 : Math.round(m.volume * 100))}٪</b>
      </div>
    </div>
  );
}
