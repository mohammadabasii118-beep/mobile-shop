import { useCallback, useEffect, useState } from 'react';
import { rewardLabel, taskText, type TaskState } from '@game/shared';
import type { Ctx } from './App';
import { call } from './net';
import { Modal, fa, fmtLong } from './ui';

const boxName = (ctx: Ctx) => (b: 'bronze' | 'silver' | 'gold') => ctx.cfg.box.types[b]?.name ?? b;

/** تعداد تسک‌های آماده‌ی دریافت جایزه (برای نشان قرمز روی دکمه) */
export function useClaimable(ctx: Ctx, panelOpen: boolean) {
  const [n, setN] = useState(0);
  const load = useCallback(async () => {
    try { const j = await call('/api/tasks', {}); setN((j.taskState as TaskState).tasks.filter((t) => !t.claimed && t.progress >= t.target).length); } catch { /* ignore */ }
  }, []);
  useEffect(() => { void load(); }, [load, panelOpen, ctx.profile.wins, ctx.profile.losses, ctx.profile.coins]);
  return n;
}

/** پنل تسک‌های هفتگی: ۱۰ تسک، نوار پیشرفت و دکمه‌ی دریافت جایزه */
export function TaskPanel({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const { toast, setProfile } = ctx;
  const [st, setSt] = useState<TaskState | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [at] = useState(Date.now());
  useEffect(() => { void call('/api/tasks', {}).then((j) => setSt(j.taskState)).catch((e) => toast((e as Error).message)); }, [toast]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const claim = async (slot: number) => {
    if (busy) return;
    setBusy(true);
    try {
      const j = await call('/api/tasks/claim', { slot });
      setSt(j.taskState); setProfile(j.profile);
      toast(`🎁 ${rewardLabel(j.reward, boxName(ctx), fa)} گرفتی`);
    } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };
  const left = st ? Math.max(0, st.resetInMs - (now - at)) : 0;
  const done = st?.tasks.filter((t) => t.claimed).length ?? 0;
  return (
    <div className="overlay glass" onClick={onClose}>
      <div className="lbpanel friends" role="dialog" aria-label="تسک‌های هفتگی" onClick={(e) => e.stopPropagation()}>
        <header>
          <button className="lbx" onClick={onClose} aria-label="بستن">✕</button>
          <h3>تسک‌های هفتگی</h3>
        </header>
        {st && <small className="hint">شروع هفته‌ی بعد تا <b className="num">{fmtLong(left)}</b> · {fa(done)} از {fa(st.tasks.length)} جایزه گرفته شد<br />جایزه‌های نگرفته آخر هفته می‌سوزند و تسک‌ها عوض می‌شوند.</small>}
        {!st && <p className="lbmsg">در حال بارگذاری…</p>}
        {st && (
          <ul className="tasklist">
            {st.tasks.map((t) => {
              const ready = !t.claimed && t.progress >= t.target;
              return (
                <li key={t.slot} className={`${ready ? 'done' : ''} ${t.claimed ? 'got' : ''}`}>
                  <span className="tt">{taskText(t.type, t.target, fa)}</span>
                  {t.claimed ? <span>✅ گرفته شد</span> : ready ? <button className="btn" disabled={busy} onClick={() => void claim(t.slot)}>دریافت</button> : <span />}
                  <div className="tp"><i style={{ width: `${Math.min(100, (t.progress / t.target) * 100)}%` }} /></div>
                  <span className="tr"><span>🎁 {rewardLabel(t.reward, boxName(ctx), fa)}</span><span className="num">{fa(t.progress)} / {fa(t.target)}</span></span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
