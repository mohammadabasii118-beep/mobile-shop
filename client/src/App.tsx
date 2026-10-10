import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameConfig, Profile, ServerMsg } from '@game/shared';
import { loadConfig, loadProfile, Socket } from './net';
import { Home } from './Home';
import { CardsScreen } from './CardsScreen';
import { BattleScreen, type BattleInit } from './BattleScreen';
import { Admin } from './Admin';
import { Modal, fa } from './ui';
import type { BattleReward } from '@game/shared';

export interface Ctx {
  cfg: GameConfig;
  setCfg: (c: GameConfig) => void;
  profile: Profile;
  setProfile: (p: Profile) => void;
  sock: Socket;
  toast: (s: string) => void;
}

export function App() {
  const [cfg, setCfg] = useState<GameConfig | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'home' | 'cards' | 'admin'>('home');
  const [battle, setBattle] = useState<BattleInit | null>(null);
  const [result, setResult] = useState<Extract<ServerMsg, { t: 'battleEnd' }> | null>(null);
  const [queued, setQueued] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const sock = useRef(new Socket()).current;
  const timer = useRef<number>();

  const toast = useCallback((s: string) => {
    setToastMsg(s);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastMsg(null), 2800);
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
      if (m.t === 'closed') return setErr('ارتباط با سرور قطع شد. صفحه را دوباره باز کن.');
      if (m.t === 'ready' || m.t === 'profile') setProfile(m.profile);
      if (m.t === 'queued') setQueued(true);
      if (m.t === 'error') { setQueued(false); toast(m.message); }
      if (m.t === 'battleStart') { setQueued(false); setResult(null); setBattle({ start: m }); }
    });
  }, [sock, toast]);

  if (err) return <div className="center"><h2>😕</h2><p>{err}</p><button className="btn" onClick={() => location.reload()}>تلاش دوباره</button></div>;
  if (!cfg || !profile) return <div className="center"><div className="spinner" /><p>در حال بارگذاری…</p></div>;

  const ctx: Ctx = { cfg, setCfg, profile, setProfile, sock, toast };
  const onBattleDone = (end: Extract<ServerMsg, { t: 'battleEnd' }>) => { setProfile(end.profile); setResult(end); };

  return (
    <div className="app">
      {battle ? (
        <BattleScreen ctx={ctx} init={battle} onDone={onBattleDone} onExit={() => { setBattle(null); setResult(null); }} result={result} />
      ) : (
        tab === 'admin' ? <Admin ctx={ctx} onExit={async () => { setTab('home'); try { setCfg(await loadConfig()); } catch { /* ignore */ } }} /> : <>
          <div className="screen">
            {tab === 'home' ? <Home ctx={ctx} queued={queued} onAdmin={() => setTab('admin')} /> : <CardsScreen ctx={ctx} />}
          </div>
          <nav className="nav">
            <button className={tab === 'home' ? 'on' : ''} onClick={() => setTab('home')}>⚔️<span>بازی</span></button>
            <button className={tab === 'cards' ? 'on' : ''} onClick={() => setTab('cards')}>🃏<span>کارت‌ها</span></button>
          </nav>
        </>
      )}
      {queued && !battle && (
        <Modal>
          <div className="center-in"><div className="spinner" /><h3>در حال جستجوی حریف…</h3>
            <button className="btn ghost" onClick={() => { sock.send({ t: 'leaveQueue' }); setQueued(false); }}>انصراف</button></div>
        </Modal>
      )}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}

export const rewardText = (r: BattleReward | null, boxName?: string) =>
  !r ? '' : r.box === null && !r.noSlot ? 'این بار جعبه‌ای نیامد.' : r.box !== null ? `🎁 یک جعبه‌ی ${boxName ?? ''} گرفتی! (اسلات ${fa(r.box + 1)})` : '📦 اسلات‌های جعبه پر است؛ این بار جعبه‌ای نگرفتی.';
