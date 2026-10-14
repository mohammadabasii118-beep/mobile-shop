import { useCallback, useEffect, useState } from 'react';
import type { FriendBase, FriendView } from '@game/shared';
import type { Ctx } from './App';
import { call } from './net';
import { Avatar } from './Home';
import { Modal, fa } from './ui';

interface State { friends: FriendView[]; incoming: FriendBase[]; outgoing: FriendBase[]; code: number }
const STATUS_TEXT: Record<string, string> = { declined: 'دعوتت رد شد', expired: 'جوابی نیامد؛ دعوت منقضی شد', busy: 'دوستت الان درگیر است', offline: 'دوستت آنلاین نیست', canceled: 'دعوت لغو شد' };

/** صفحه‌ی دوستان: کد دوست، افزودن، درخواست‌ها، فهرست دوستان و دعوت به بازی دوستانه (بدون جایزه) */
export function Friends({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const { sock, toast } = ctx;
  const [st, setSt] = useState<State | null>(null);
  const [code, setCode] = useState('');
  const [waiting, setWaiting] = useState<FriendView | null>(null);
  const load = useCallback(async (path = '/api/friends', body?: object) => {
    try { setSt(await call(path, body ?? {})); } catch (e) { toast((e as Error).message); }
  }, [toast]);

  useEffect(() => { void load(); const t = setInterval(() => void load(), 8000); return () => clearInterval(t); }, [load]);
  useEffect(() => sock.on((m) => {
    if (m.t === 'inviteResult') { setWaiting(null); toast(STATUS_TEXT[m.status] ?? ''); }
    if (m.t === 'notice') void load();
  }), [sock, toast, load]);
  // بستن صفحه وسط انتظار = لغو دعوت
  useEffect(() => () => { sock.send({ t: 'inviteCancel' }); }, [sock]);

  const add = async () => {
    if (!code.trim()) return;
    try {
      const j = await call('/api/friends/add', { code });
      setSt(j); setCode(''); toast(j.accepted ? 'دوست شدید 🤝' : 'درخواست فرستاده شد ✅');
    } catch (e) { toast((e as Error).message); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(String(st?.code ?? ctx.profile.id)); toast('کد کپی شد'); } catch { toast(`کد تو: ${st?.code ?? ctx.profile.id}`); }
  };
  const invite = (f: FriendView) => { setWaiting(f); sock.send({ t: 'invite', to: f.id }); };

  return (
    <>
      <div className="overlay glass" onClick={onClose}>
        <div className="lbpanel friends" role="dialog" aria-label="دوستان" onClick={(e) => e.stopPropagation()}>
          <header>
            <button className="lbx" onClick={onClose} aria-label="بستن">✕</button>
            <h3>دوستان</h3>
          </header>
          <div className="mycode">
            <span>کد دوست تو</span>
            <button onClick={copy}><b className="num">{fa(st?.code ?? ctx.profile.id)}</b> 📋</button>
          </div>
          <div className="addrow">
            <input inputMode="numeric" placeholder="کد دوستت را بنویس" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void add()} />
            <button className="btn" onClick={() => void add()}>افزودن</button>
          </div>
          {!st && <p className="lbmsg">در حال بارگذاری…</p>}
          {st && st.incoming.length > 0 && (
            <>
              <h4>درخواست‌های دریافتی</h4>
              <ul className="flist">
                {st.incoming.map((f) => (
                  <li key={f.id}>
                    <Avatar url={f.avatar} name={f.name} />
                    <span className="nm"><b>{f.name}</b><small>لول {fa(f.level)}</small></span>
                    <button className="btn" onClick={() => void load('/api/friends/accept', { id: f.id })}>قبول</button>
                    <button className="btn ghost" onClick={() => void load('/api/friends/remove', { id: f.id })}>رد</button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {st && (
            <>
              <h4>دوستان ({fa(st.friends.length)})</h4>
              <ul className="flist">
                {st.friends.map((f) => (
                  <li key={f.id}>
                    <span className={`dot ${f.online ? (f.busy ? 'busy' : 'on') : ''}`} aria-label={f.online ? (f.busy ? 'در مبارزه' : 'آنلاین') : 'آفلاین'} />
                    <Avatar url={f.avatar} name={f.name} />
                    <span className="nm"><b>{f.name}</b><small>لول {fa(f.level)} · {fa(f.trophies)} 🏆{f.online ? (f.busy ? ' · در مبارزه' : ' · آنلاین') : ''}</small></span>
                    <button className="btn" disabled={!f.online || f.busy || !!waiting} onClick={() => invite(f)}>⚔ بازی</button>
                    <button className="btn ghost" aria-label="حذف دوست" onClick={() => { if (confirm(`«${f.name}» از دوستانت حذف شود؟`)) void load('/api/friends/remove', { id: f.id }); }}>🗑</button>
                  </li>
                ))}
                {st.friends.length === 0 && <li className="lbmsg">هنوز دوستی نداری. کدت را برای دوستانت بفرست یا کد آن‌ها را وارد کن.</li>}
              </ul>
            </>
          )}
          {st && st.outgoing.length > 0 && (
            <>
              <h4>درخواست‌های فرستاده‌شده</h4>
              <ul className="flist">
                {st.outgoing.map((f) => (
                  <li key={f.id}>
                    <Avatar url={f.avatar} name={f.name} />
                    <span className="nm"><b>{f.name}</b><small>منتظر پذیرفتن</small></span>
                    <button className="btn ghost" onClick={() => void load('/api/friends/remove', { id: f.id })}>لغو</button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <small className="hint">بازی با دوست دوستانه است: جعبه، سکه و کاپ ندارد.</small>
        </div>
      </div>
      {waiting && (
        <Modal>
          <div className="center-in"><div className="spinner" /><h3>منتظر پاسخ {waiting.name}…</h3>
            <button className="btn ghost" onClick={() => { sock.send({ t: 'inviteCancel' }); setWaiting(null); }}>لغو دعوت</button></div>
        </Modal>
      )}
    </>
  );
}
