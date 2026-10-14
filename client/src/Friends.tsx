import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { FriendBase, FriendView } from '@game/shared';
import type { Ctx } from './App';
import { call } from './net';
import { Avatar } from './Home';
import { Modal, fa } from './ui';
import { openLink } from './telegram';

interface State { friends: FriendView[]; incoming: FriendBase[]; outgoing: FriendBase[]; code: number; refLink: string | null }
type Relation = 'self' | 'friend' | 'outgoing' | 'incoming' | 'none';
const STATUS_TEXT: Record<string, string> = { declined: 'دعوتت رد شد', expired: 'جوابی نیامد؛ دعوت منقضی شد', busy: 'دوستت الان درگیر است', offline: 'دوستت آنلاین نیست', canceled: 'دعوت لغو شد' };

function useFriends(ctx: Ctx) {
  const { sock, toast } = ctx;
  const [st, setSt] = useState<State | null>(null);
  const load = useCallback(async (path = '/api/friends', body?: object) => {
    try { const j = await call(path, body ?? {}); setSt(j); return j as State & { accepted?: boolean }; } catch (e) { toast((e as Error).message); return null; }
  }, [toast]);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 6000); return () => clearInterval(t); }, [load]);
  useEffect(() => sock.on((m) => { if (m.t === 'notice') void load(); }), [sock, load]);
  return { st, load };
}

/** دعوت به بازی دوستانه: وضعیت انتظار (۱۰ ثانیه) و لغو؛ بستن صفحه = لغو دعوت */
function useInvite(ctx: Ctx) {
  const { sock, toast } = ctx;
  const [waiting, setWaiting] = useState<FriendView | null>(null);
  useEffect(() => sock.on((m) => { if (m.t === 'inviteResult') { setWaiting(null); toast(STATUS_TEXT[m.status] ?? ''); } }), [sock, toast]);
  useEffect(() => () => { sock.send({ t: 'inviteCancel' }); }, [sock]);
  const invite = (f: FriendView) => { setWaiting(f); sock.send({ t: 'invite', to: f.id }); };
  const modal: ReactNode = waiting && (
    <Modal>
      <div className="center-in"><div className="spinner" /><h3>منتظر پاسخ {waiting.name}…</h3>
        <button className="btn ghost" onClick={() => { sock.send({ t: 'inviteCancel' }); setWaiting(null); }}>لغو دعوت</button></div>
    </Modal>
  );
  return { waiting, invite, modal };
}

const statusText = (f: FriendView) => (f.online ? (f.busy ? 'در مبارزه' : 'آنلاین') : 'آفلاین');
const Dot = ({ f }: { f: FriendView }) => <span className={`dot ${f.online ? (f.busy ? 'busy' : 'on') : ''}`} aria-label={statusText(f)} />;

/** پنل دوستان (شیشه‌ای): تب «دوستان» و تب «جستجو» با لینک دعوت */
export function FriendsPanel({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const { toast } = ctx;
  const { st, load } = useFriends(ctx);
  const [tab, setTab] = useState<'list' | 'search'>('list');
  const [code, setCode] = useState('');
  const [found, setFound] = useState<{ player: FriendBase; relation: Relation } | null>(null);

  const search = async () => {
    if (!code.trim()) return;
    try { setFound(await call('/api/friends/search', { code })); } catch (e) { setFound(null); toast((e as Error).message); }
  };
  const add = async (id: number) => {
    const j = await load('/api/friends/add', { code: String(id) });
    if (j) { toast(j.accepted ? 'دوست شدید 🤝' : 'درخواست فرستاده شد ✅'); setFound({ player: found!.player, relation: j.accepted ? 'friend' : 'outgoing' }); }
  };
  const copy = async (text: string, msg: string) => { try { await navigator.clipboard.writeText(text); toast(msg); } catch { toast(text); } };
  const share = (link: string) => openLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('بیا با هم توی بازی میراث مبارزه کنیم ⚔')}`);
  const reqCount = st?.incoming.length ?? 0;

  return (
    <div className="overlay glass" onClick={onClose}>
      <div className="lbpanel friends" role="dialog" aria-label="دوستان" onClick={(e) => e.stopPropagation()}>
        <header>
          <button className="lbx" onClick={onClose} aria-label="بستن">✕</button>
          <h3>دوستان</h3>
        </header>
        <div className="pits" role="tablist">
          <button role="tab" className="pit" aria-selected={tab === 'list'} onClick={() => setTab('list')}>دوستان{reqCount ? ` (${fa(reqCount)} درخواست)` : ''}</button>
          <button role="tab" className="pit" aria-selected={tab === 'search'} onClick={() => setTab('search')}>جستجو</button>
        </div>

        {tab === 'list' && (
          <>
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
              <ul className="flist">
                {st.friends.map((f) => (
                  <li key={f.id}>
                    <Dot f={f} />
                    <Avatar url={f.avatar} name={f.name} />
                    <span className="nm"><b>{f.name}</b><small>لول {fa(f.level)} · {fa(f.trophies)} 🏆 · {statusText(f)}</small></span>
                    <button className="btn ghost" aria-label="حذف دوست" onClick={() => { if (confirm(`«${f.name}» از دوستانت حذف شود؟`)) void load('/api/friends/remove', { id: f.id }); }}>🗑</button>
                  </li>
                ))}
                {st.friends.length === 0 && <li className="lbmsg">هنوز دوستی نداری. از تب «جستجو» دوست اضافه کن یا لینک دعوتت را بفرست.</li>}
              </ul>
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
          </>
        )}

        {tab === 'search' && (
          <>
            <div className="mycode">
              <span>شناسه‌ی تو</span>
              <button onClick={() => void copy(String(st?.code ?? ctx.profile.id), 'شناسه کپی شد')}><b className="num">{fa(st?.code ?? ctx.profile.id)}</b> 📋</button>
            </div>
            <div className="addrow">
              <input inputMode="numeric" placeholder="شناسه‌ی عددی بازیکن" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void search()} />
              <button className="btn" onClick={() => void search()}>جستجو</button>
            </div>
            {found && (
              <ul className="flist">
                <li>
                  <Avatar url={found.player.avatar} name={found.player.name} />
                  <span className="nm"><b>{found.player.name}</b><small>لول {fa(found.player.level)} · {fa(found.player.trophies)} 🏆 · شناسه {fa(found.player.id)}</small></span>
                  {found.relation === 'none' && <button className="btn" onClick={() => void add(found.player.id)}>افزودن به دوستان</button>}
                  {found.relation === 'incoming' && <button className="btn" onClick={() => void add(found.player.id)}>قبول درخواست</button>}
                  {found.relation === 'outgoing' && <small>درخواست فرستاده شده</small>}
                  {found.relation === 'friend' && <small>دوست شما است ✅</small>}
                  {found.relation === 'self' && <small>این خودتی 😄</small>}
                </li>
              </ul>
            )}
            <div className="reflink">
              <b>لینک دعوت من</b>
              <small>هر کس با این لینک وارد ربات شود، مستقیم دوست تو می‌شود.</small>
              {st?.refLink ? (
                <>
                  <input readOnly value={st.refLink} onFocus={(e) => e.currentTarget.select()} dir="ltr" />
                  <div className="row">
                    <button className="btn" onClick={() => share(st.refLink!)}>ارسال لینک</button>
                    <button className="btn ghost" onClick={() => void copy(st.refLink!, 'لینک کپی شد')}>کپی</button>
                  </div>
                </>
              ) : <small>لینک دعوت فقط در نسخه‌ی واقعی ربات ساخته می‌شود.</small>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** انتخاب دوست آنلاین برای بازی دوستانه (دکمه‌ی «دوستانه») */
export function FriendPicker({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const { st } = useFriends(ctx);
  const { waiting, invite, modal } = useInvite(ctx);
  const online = (st?.friends ?? []).filter((f) => f.online);
  return (
    <>
      <div className="overlay glass" onClick={onClose}>
        <div className="lbpanel friends" role="dialog" aria-label="بازی دوستانه" onClick={(e) => e.stopPropagation()}>
          <header>
            <button className="lbx" onClick={onClose} aria-label="بستن">✕</button>
            <h3>بازی دوستانه</h3>
          </header>
          <small className="hint">به یکی از دوستان آنلاینت درخواست مبارزه بفرست. این بازی جایزه ندارد (نه سکه، نه XP، نه جعبه).</small>
          {!st && <p className="lbmsg">در حال بارگذاری…</p>}
          {st && (
            <ul className="flist">
              {online.map((f) => (
                <li key={f.id}>
                  <Dot f={f} />
                  <Avatar url={f.avatar} name={f.name} />
                  <span className="nm"><b>{f.name}</b><small>لول {fa(f.level)} · {statusText(f)}</small></span>
                  <button className="btn" disabled={f.busy || !!waiting} onClick={() => invite(f)}>⚔ درخواست</button>
                </li>
              ))}
              {online.length === 0 && <li className="lbmsg">الان هیچ‌کدام از دوستانت آنلاین نیست.</li>}
            </ul>
          )}
        </div>
      </div>
      {modal}
    </>
  );
}
