import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameConfig, Profile, ServerMsg } from '@game/shared';
import { loadConfig, loadProfile, reloadIfOutdated, Socket } from './net';
import { Home } from './Home';
import { CardsScreen } from './CardsScreen';
import { Shop } from './Shop';
import { BattleScreen, type BattleInit } from './BattleScreen';
import { Admin } from './Admin';
import { Gate } from './Gate';
import { initDebug } from './telegram';
import { setScene } from './music';
import { Modal, fa } from './ui';
import type { BattleReward } from '@game/shared';

export interface Ctx {
  cfg: GameConfig;
  setCfg: (c: GameConfig) => void;
  profile: Profile;
  /** لحظه‌ی دریافت این پروفایل (برای محاسبه‌ی درست شمارنده‌ی جعبه‌ها، حتی بعد از جابه‌جایی بین صفحه‌ها) */
  profileAt: number;
  setProfile: (p: Profile) => void;
  sock: Socket;
  toast: (s: string) => void;
}

export function App() {
  const [cfg, setCfg] = useState<GameConfig | null>(null);
  const [profile, setProfileRaw] = useState<Profile | null>(null);
  const [profileAt, setProfileAt] = useState(Date.now());
  const setProfile = useCallback((p: Profile) => { setProfileAt(Date.now()); setProfileRaw(p); }, []);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'home' | 'cards' | 'shop' | 'admin'>('home');
  const [battle, setBattle] = useState<BattleInit | null>(null);
  const [result, setResult] = useState<Extract<ServerMsg, { t: 'battleEnd' }> | null>(null);
  const [queued, setQueued] = useState(false);
  const [invited, setInvited] = useState<{ from: number; name: string } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const sock = useRef(new Socket()).current;
  const timer = useRef<number>();

  // آهنگ نبرد فقط وقتی داخل دوئل (سولو یا آنلاین) هستیم
  useEffect(() => { setScene(battle ? 'battle' : 'menu'); }, [!!battle]);

  const toast = useCallback((s: string) => {
    setToastMsg(s);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);

  // نسخه‌ی جدید؟ هنگام باز شدن و هر بار که بازی از پس‌زمینه برمی‌گردد چک می‌شود
  useEffect(() => {
    void reloadIfOutdated();
    const onVis = () => { if (document.visibilityState === 'visible') void reloadIfOutdated(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setCfg(await loadConfig());
        setProfile(await loadProfile());
        await sock.connect();
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
    return sock.on((m) => {
      if (m.t === 'closed') return setErr(m.code === 4001 ? 'این حساب هم‌زمان جای دیگری (پنجره یا دستگاه دیگر) باز شد و این نشست بسته شد.' : 'ارتباط با سرور قطع شد. صفحه را دوباره باز کن.');
      if (m.t === 'ready' || m.t === 'profile') setProfile(m.profile);
      if (m.t === 'queued') setQueued(true);
      if (m.t === 'error') { setQueued(false); toast(m.message); }
      if (m.t === 'notice') toast(m.message);
      if (m.t === 'invited') setInvited({ from: m.from, name: m.name });
      if (m.t === 'inviteResult') setInvited(null);
      if (m.t === 'battleStart') { setInvited(null); setQueued(false); setResult(null); setBattle({ start: m }); }
    });
  }, [sock, toast]);

  if (err) return <div className="center"><h2>😕</h2><p>{err}</p><small className="dbg" dir="rtl">{initDebug()}</small><button className="btn" onClick={() => location.reload()}>تلاش دوباره</button></div>;
  if (!cfg || !profile) return <div className="center"><div className="spinner" /><p>در حال بارگذاری…</p></div>;

  const ctx: Ctx = { cfg, setCfg, profile, profileAt, setProfile, sock, toast };
  const onBattleDone = (end: Extract<ServerMsg, { t: 'battleEnd' }>) => { setProfile(end.profile); setResult(end); };

  return (
    <div className="app" style={cfg.ui?.background ? { backgroundImage: `linear-gradient(rgba(8,14,26,.25), rgba(8,14,26,.45)), url(${cfg.ui.background})`, backgroundSize: 'cover', backgroundPosition: 'center bottom', backgroundRepeat: 'no-repeat' } : undefined}>
      {battle ? (
        <BattleScreen ctx={ctx} init={battle} onDone={onBattleDone} onExit={() => { setBattle(null); setResult(null); }} result={result} />
      ) : (
        tab === 'admin' ? <Admin ctx={ctx} onExit={async () => { setTab('home'); try { setCfg(await loadConfig()); } catch { /* ignore */ } }} /> : <>
          <div className="screen">
            {tab === 'home' ? <Home ctx={ctx} queued={queued} onAdmin={() => setTab('admin')} /> : tab === 'cards' ? <CardsScreen ctx={ctx} /> : <Shop ctx={ctx} />}
          </div>
          <nav className="nav">
            <button className={tab === 'home' ? 'on' : ''} onClick={() => setTab('home')} aria-current={tab === 'home' ? 'page' : undefined}>
              <svg className="ni" viewBox="0 0 24 24" aria-hidden><path d="M5 4l14 14M19 4L5 18" /><path d="M12.500 18.500l5-5M6.500 13.500l5 5" /><path d="M19 18l2 2M5 18l-2 2" /></svg>
              <span>بازی</span>
            </button>
            <button className={tab === 'cards' ? 'on' : ''} onClick={() => setTab('cards')} aria-current={tab === 'cards' ? 'page' : undefined}>
              <svg className="ni" viewBox="0 0 24 24" aria-hidden><rect x="4" y="5" width="11" height="15" rx="2" /><path d="M9 3.500h8a2 2 0 0 1 2 2V16" /><path d="M7.500 12l1.500-3 1.500 3-1.500 3z" /></svg>
              <span>کارت‌ها</span>
            </button>
            <button className={tab === 'shop' ? 'on' : ''} onClick={() => setTab('shop')} aria-current={tab === 'shop' ? 'page' : undefined}>
              <svg className="ni" viewBox="0 0 24 24" aria-hidden><path d="M4 9l1.200-4.500h13.600L20 9" /><path d="M4 9a2.700 2.700 0 0 0 5.300 0 2.700 2.700 0 0 0 5.400 0A2.700 2.700 0 0 0 20 9" /><path d="M5.500 12v7.500h13V12" /><path d="M10 19.500v-4.500h4v4.500" /></svg>
              <span>فروشگاه</span>
            </button>
          </nav>
        </>
      )}
      {queued && !battle && (
        <Modal>
          <div className="center-in"><div className="spinner" /><h3>در حال جستجوی حریف…</h3>
            <button className="btn ghost" onClick={() => { sock.send({ t: 'leaveQueue' }); setQueued(false); }}>انصراف</button></div>
        </Modal>
      )}
      {invited && !battle && (
        <Modal>
          <div className="center-in"><h3>⚔ {invited.name} تو را به بازی دوستانه دعوت کرد</h3>
            <small>بدون جایزه و کاپ</small>
            <div className="row">
              <button className="btn" onClick={() => { sock.send({ t: 'inviteReply', from: invited.from, accept: true }); setInvited(null); }}>قبول</button>
              <button className="btn ghost" onClick={() => { sock.send({ t: 'inviteReply', from: invited.from, accept: false }); setInvited(null); }}>رد</button>
            </div></div>
        </Modal>
      )}
      {!profile.channelOk && <Gate ctx={ctx} />}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}

export const rewardText = (r: BattleReward | null, boxName?: string) =>
  !r ? '' : r.box === null && !r.noSlot ? 'این بار جعبه‌ای نیامد.' : r.box !== null ? `🎁 یک جعبه‌ی ${boxName ?? ''} گرفتی! (اسلات ${fa(r.box + 1)})` : '📦 اسلات‌های جعبه پر است؛ این بار جعبه‌ای نگرفتی.';

/** خطوط جایزه‌ی آنلاین (XP و کاپ؛ سکه با آیکون جدا نمایش داده می‌شود) برای صفحه‌ی پایان نبرد */
export const onlineRewardLines = (r: BattleReward | null): string[] => {
  if (!r || r.trophies === undefined) return [];
  const out: string[] = [];
  if (r.xp) out.push(`⭐ +${fa(r.xp)} XP${r.levelsGained ? ' — لول‌آپ!' : ''}`);
  out.push(`🏆 ${r.trophies >= 0 ? '+' : '−'}${fa(Math.abs(r.trophies))} کاپ`);
  return out;
};
