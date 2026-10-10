import { useEffect, useRef, useState } from 'react';
import { ABILITY_META, type CardDef, type GameConfig, type Rarity } from '@game/shared';
import { resolveCard } from '@game/shared';
import type { Ctx } from './App';
import { call, loadConfig } from './net';
import { initData } from './telegram';
import { CardTile, RARITY_FA, fa } from './ui';

type Tab = 'cards' | 'eco' | 'solo' | 'look' | 'players' | 'json';
interface Stats { users: number; battles: number; pendingBoxes: number; coins: number; banned: number }
interface AdminUser { id: number; tg_id: number; name: string; level: number; coins: number; wins: number; losses: number; banned: number }

/** عکس را قبل از آپلود کوچک می‌کند (حداکثر ۶۴۰ پیکسل، WebP) تا سبک و سریع باشد */
async function shrink(file: File, max = 640): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const webp: Blob | null = await new Promise((r) => c.toBlob(r, 'image/webp', 0.9));
  if (webp && webp.type === 'image/webp') return webp;
  return await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'));
}

export function Admin({ ctx, onExit }: { ctx: Ctx; onExit: () => void }) {
  const [tab, setTab] = useState<Tab>('cards');
  const [cfg, setCfg] = useState<GameConfig>(ctx.cfg);
  const [stats, setStats] = useState<(Stats & { online: number; activeBattles: number }) | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const say = (text: string, ok = true) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 3500); };
  const refresh = (c: GameConfig) => { setCfg(c); ctx.setCfg(c); };
  const run = async <T,>(f: () => Promise<T>, okText?: string) => {
    try { const r = await f(); if (okText) say(okText); return r; } catch (e) { say((e as Error).message, false); return undefined; }
  };
  useEffect(() => { void run(async () => { const j = await call('/api/admin/overview'); setStats({ ...j.stats, online: j.online, activeBattles: j.activeBattles }); }); }, [tab]);

  return (
    <div className="admin">
      <header className="adminbar">
        <button className="btn ghost" onClick={onExit}>→ بازگشت به بازی</button>
        <div className="brand sm">میراث <small>پنل مدیریت</small></div>
      </header>
      {msg && <div className={`flash ${msg.ok ? 'ok' : 'bad'}`}>{msg.text}</div>}
      {stats && (
        <div className="tiles">
          <div className="tile"><small>بازیکن‌ها</small><b>{fa(stats.users)}</b></div>
          <div className="tile"><small>آنلاین الان</small><b>{fa(stats.online)}</b></div>
          <div className="tile"><small>نبرد در جریان</small><b>{fa(stats.activeBattles)}</b></div>
          <div className="tile"><small>برد کل نبردها</small><b>{fa(stats.battles)}</b></div>
          <div className="tile"><small>جعبه‌های باز نشده</small><b>{fa(stats.pendingBoxes)}</b></div>
          <div className="tile"><small>سکه در گردش</small><b>{fa(stats.coins)}</b></div>
        </div>
      )}
      <div className="tabs" role="tablist">
        {([['cards', 'کارت‌ها و عکس‌ها'], ['eco', 'جعبه و اقتصاد'], ['solo', 'سولو (گودال‌ها)'], ['look', 'ظاهر و بنر'], ['players', 'بازیکن‌ها'], ['json', 'پیشرفته']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'cards' && <CardsTab cfg={cfg} refresh={refresh} run={run} />}
      {tab === 'eco' && <EcoTab cfg={cfg} refresh={refresh} run={run} />}
      {tab === 'solo' && <SoloTab cfg={cfg} refresh={refresh} run={run} />}
      {tab === 'look' && <LookTab cfg={cfg} refresh={refresh} run={run} />}
      {tab === 'players' && <PlayersTab cfg={cfg} run={run} />}
      {tab === 'json' && <JsonTab cfg={cfg} refresh={refresh} run={run} />}
    </div>
  );
}

type Run = <T>(f: () => Promise<T>, okText?: string) => Promise<T | undefined>;
interface TabProps { cfg: GameConfig; refresh: (c: GameConfig) => void; run: Run }

const emptyCard = (cfg: GameConfig): CardDef => {
  let n = cfg.cards.length + 1;
  while (cfg.cards.some((c) => c.id === `card${n}`)) n++;
  return { id: `card${n}`, name: 'کارت تازه', rarity: 'common', hp: 100, atk: 15, shield: 0 };
};

function CardsTab({ cfg, refresh, run }: TabProps) {
  const [sel, setSel] = useState<string | undefined>(cfg.cards[0]?.id);
  const [draft, setDraft] = useState<CardDef | null>(null);
  const [isNew, setIsNew] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const saved = cfg.cards.find((c) => c.id === sel);
  useEffect(() => { if (!isNew) setDraft(saved ? { ...saved, ability: saved.ability ? { ...saved.ability, params: { ...saved.ability.params } } : undefined } : null); }, [sel, cfg, isNew]);
  if (!draft) return <p className="hint">کارتی نیست.</p>;
  const set = (p: Partial<CardDef>) => setDraft({ ...draft, ...p });
  const num = (v: string) => (v === '' ? 0 : Number(v));
  const meta = draft.ability ? ABILITY_META[draft.ability.id] : null;

  const save = () => run(async () => {
    const next = await call('/api/admin/card', { card: draft }); refresh(next); setIsNew(false); setSel(draft.id);
  }, 'ذخیره شد و همین الان در بازی اعمال شد');
  const del = () => run(async () => { refresh(await call('/api/admin/card/delete', { id: draft.id })); setIsNew(false); setSel(cfg.cards.find((c) => c.id !== draft.id)?.id); }, 'کارت حذف شد');
  const upload = async (f: File | undefined) => {
    if (!f) return;
    await run(async () => {
      if (isNew) throw new Error('اول کارت را ذخیره کن، بعد عکس بگذار');
      const blob = await shrink(f);
      const r = await fetch(`/api/admin/card-image?cardId=${encodeURIComponent(draft.id)}`, { method: 'POST', headers: { 'x-init-data': initData, 'content-type': blob.type }, body: blob });
      const j = await r.json(); if (!r.ok) throw new Error(j.error); refresh(j as GameConfig);
    }, 'عکس کارت عوض شد');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="cols">
      <div className="box">
        <h3>فهرست کارت‌ها</h3>
        <div className="list">
          {cfg.cards.map((c) => (
            <button key={c.id} aria-pressed={!isNew && sel === c.id} onClick={() => { setIsNew(false); setSel(c.id); }}>
              <span>{c.name}</span><span className={`rar ${c.rarity}`}>{RARITY_FA[c.rarity]}</span>
            </button>
          ))}
        </div>
        <button className="btn ghost" onClick={() => { setDraft(emptyCard(cfg)); setIsNew(true); }}>+ کارت جدید</button>
      </div>

      <div className="box">
        <h3>{isNew ? 'کارت جدید' : `ویرایش «${saved?.name}»`}</h3>
        <div className="picrow">
          <div className="pic-prev"><CardTile def={draft} level={1} hp={draft.hp} atk={draft.atk} shield={draft.shield} /></div>
          <div className="picctl">
            <b>عکس کارت</b>
            <small>PNG، JPG یا WebP. مربعی بهتر است؛ خودکار کوچک می‌شود.</small>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void upload(e.target.files?.[0])} />
            <div className="btns">
              <button className="btn" onClick={() => fileRef.current?.click()}>{draft.image ? 'تغییر عکس' : 'آپلود عکس'}</button>
              {draft.image && !isNew && <button className="btn ghost" onClick={() => run(async () => refresh(await call('/api/admin/card-image/delete', { cardId: draft.id })), 'عکس حذف شد')}>حذف عکس</button>}
            </div>
          </div>
        </div>
        <div className="fgrid">
          <label className="field">شناسه (انگلیسی)<input value={draft.id} disabled={!isNew} onChange={(e) => set({ id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} /></label>
          <label className="field">نام<input value={draft.name} onChange={(e) => set({ name: e.target.value })} /></label>
          <label className="field">نادری
            <select value={draft.rarity} onChange={(e) => set({ rarity: e.target.value as Rarity })}>
              {(['common', 'rare', 'epic'] as Rarity[]).map((r) => <option key={r} value={r}>{RARITY_FA[r]}</option>)}
            </select>
          </label>
        </div>
        <div className="fgrid">
          <label className="field">جان<input type="number" min={1} value={draft.hp} onChange={(e) => set({ hp: num(e.target.value) })} /></label>
          <label className="field">حمله<input type="number" min={0} value={draft.atk} onChange={(e) => set({ atk: num(e.target.value) })} /></label>
          <label className="field">شیلد<input type="number" min={0} value={draft.shield} onChange={(e) => set({ shield: num(e.target.value) })} /></label>
        </div>
        <div className="fgrid">
          <label className="field">توانایی
            <select value={draft.ability?.id ?? ''} onChange={(e) => {
              const id = e.target.value;
              if (!id) return set({ ability: undefined, desc: undefined });
              set({ ability: { id, params: Object.fromEntries(ABILITY_META[id].params.map((p) => [p.key, p.def])) } });
            }}>
              <option value="">— بدون توانایی —</option>
              {Object.entries(ABILITY_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
            </select>
          </label>
          {meta?.params.map((p) => (
            <label key={p.key} className="field">{p.label}
              <input type="number" value={draft.ability?.params?.[p.key] ?? p.def} onChange={(e) => set({ ability: { id: draft.ability!.id, params: { ...draft.ability!.params, [p.key]: num(e.target.value) } } })} />
            </label>
          ))}
        </div>
        {draft.ability && <label className="field">توضیح توانایی (به بازیکن نشان داده می‌شود)<input value={draft.desc ?? ''} onChange={(e) => set({ desc: e.target.value })} /></label>}
        <h3>مسیر قدرت‌گیری <small>هر لول طبق جدول ضریب، آمار بیشتر و قاب جدید</small></h3>
        <div className="evo">
          {Array.from({ length: cfg.upgrade.maxLevel }, (_, i) => {
            const s = resolveCard(draft, i + 1, cfg);
            const need = cfg.upgrade.levels[i - 1];
            return (
              <div key={i}>
                <CardTile def={draft} level={i + 1} maxLevel={cfg.upgrade.maxLevel} hp={s.hp} atk={s.atk} shield={s.shield} />
                <span>{i === 0 ? 'پایه' : `${fa(need.copies)} کارت + ${fa(need.coins)}`}</span>
              </div>
            );
          })}
        </div>
        <div className="btns">
          <button className="btn" onClick={save}>ذخیره و اعمال</button>
          {!isNew && <button className="btn ghost danger" onClick={() => { if (window.confirm?.('این کارت حذف شود؟') !== false) void del(); }}>حذف کارت</button>}
        </div>
      </div>
    </div>
  );
}

function EcoTab({ cfg, refresh, run }: TabProps) {
  const [d, setD] = useState<GameConfig>(() => JSON.parse(JSON.stringify(cfg)));
  const n = (v: string) => (v === '' ? 0 : Number(v));
  const f = (label: string, v: number, on: (x: number) => void, step = 1) => (
    <label className="field">{label}<input type="number" step={step} value={v} onChange={(e) => on(n(e.target.value))} /></label>
  );
  const total = d.upgrade.levels.reduce((s, l) => ({ c: s.c + l.copies, k: s.k + l.coins }), { c: 0, k: 0 });
  const cc = d.box.cardChance;
  const upd = (fn: (c: GameConfig) => void) => { const c = JSON.parse(JSON.stringify(d)) as GameConfig; fn(c); setD(c); };
  const setMax = (m: number) => upd((c) => {
    c.upgrade.maxLevel = m;
    while (c.upgrade.levels.length < m - 1) { const last = c.upgrade.levels[c.upgrade.levels.length - 1] ?? { copies: 2, coins: 50 }; c.upgrade.levels.push({ copies: last.copies * 2, coins: last.coins * 2 }); }
    c.upgrade.levels.length = m - 1;
  });
  return (
    <div className="cols">
      <div className="box">
        <h3>جعبه</h3>
        <div className="fgrid">
          {f('زمان باز شدن (ساعت)', d.box.durationSeconds / 3600, (x) => upd((c) => { c.box.durationSeconds = Math.round(x * 3600); }), 0.25)}
          {f('تعداد اسلات', d.box.slots, (x) => upd((c) => { c.box.slots = x; }))}
          {f('سکه — حداقل', d.box.coins[0], (x) => upd((c) => { c.box.coins[0] = x; }))}
          {f('سکه — حداکثر', d.box.coins[1], (x) => upd((c) => { c.box.coins[1] = x; }))}
          {f('XP — حداقل', d.box.xp[0], (x) => upd((c) => { c.box.xp[0] = x; }))}
          {f('XP — حداکثر', d.box.xp[1], (x) => upd((c) => { c.box.xp[1] = x; }))}
        </div>
        <h3>شانس کارت (٪)</h3>
        <div className="fgrid">
          {f('حماسی', Math.round(cc.epic * 100), (x) => upd((c) => { c.box.cardChance.epic = x / 100; }))}
          {f('نادر', Math.round(cc.rare * 100), (x) => upd((c) => { c.box.cardChance.rare = x / 100; }))}
          {f('معمولی', Math.round(cc.common * 100), (x) => upd((c) => { c.box.cardChance.common = x / 100; }))}
        </div>
        <small className="hint">شانس بدون کارت: {fa(Math.round((1 - cc.epic - cc.rare - cc.common) * 100))}٪</small>
        <h3>هزینه‌ی ورود به نبرد (سکه)</h3>
        <div className="fgrid">
          {f('هر مرحله‌ی سولو', d.fees?.solo ?? 0, (x) => upd((c) => { c.fees = { solo: x, multi: c.fees?.multi ?? 0 }; }))}
          {f('ورود به مولتی‌پلیر', d.fees?.multi ?? 0, (x) => upd((c) => { c.fees = { solo: c.fees?.solo ?? 0, multi: x }; }))}
        </div>
        <h3>نبرد</h3>
        <div className="fgrid">
          {f('مهلت انتخاب هدف (ثانیه)', d.turnSeconds, (x) => upd((c) => { c.turnSeconds = x; }))}
          {f('سقف دور (مخفی)', d.maxRounds, (x) => upd((c) => { c.maxRounds = x; }))}
          {f('رشد جان هر لول (٪)', Math.round(d.levelScale.hp * 100), (x) => upd((c) => { c.levelScale.hp = x / 100; }))}
          {f('رشد حمله هر لول (٪)', Math.round(d.levelScale.atk * 100), (x) => upd((c) => { c.levelScale.atk = x / 100; }))}
          {f('رشد شیلد هر لول (٪)', Math.round(d.levelScale.shield * 100), (x) => upd((c) => { c.levelScale.shield = x / 100; }))}
        </div>
      </div>
      <div className="box">
        <h3>هزینه‌ی ارتقا</h3>
        {f('حداکثر لول کارت', d.upgrade.maxLevel, setMax)}
        <div className="tblwrap"><table>
          <thead><tr><th>از لول</th><th>تعداد کارت</th><th>سکه</th></tr></thead>
          <tbody>{d.upgrade.levels.map((l, i) => (
            <tr key={i}><td>{fa(i + 1)} ← {fa(i + 2)}</td>
              <td><input className="cell" type="number" min={1} value={l.copies} onChange={(e) => upd((c) => { c.upgrade.levels[i].copies = n(e.target.value); })} /></td>
              <td><input className="cell" type="number" min={0} value={l.coins} onChange={(e) => upd((c) => { c.upgrade.levels[i].coins = n(e.target.value); })} /></td></tr>
          ))}</tbody>
        </table></div>
        <small className="hint">رساندن یک کارت تا لول آخر: {fa(total.c)} کارت (تعداد) و {fa(total.k)} سکه</small>
        <button className="btn" onClick={() => run(async () => refresh((await call('/api/admin/config', { config: d })) as GameConfig), 'ذخیره شد و اعمال شد')}>ذخیره و اعمال</button>
      </div>
    </div>
  );
}

/** ویرایش حریف هر لول سولو: سه کارت (با لول) و هوش ربات */
function SoloTab({ cfg, refresh, run }: TabProps) {
  const [d, setD] = useState<GameConfig>(() => JSON.parse(JSON.stringify(cfg)));
  const [pit, setPit] = useState(0);
  const [lvl, setLvl] = useState(0);
  const stage = d.solo.pits[pit].stages[lvl];
  const edit = (fn: (s: typeof stage) => void) => { const c = JSON.parse(JSON.stringify(d)) as GameConfig; fn(c.solo.pits[pit].stages[lvl]); setD(c); };
  const copyPrev = () => { if (lvl === 0) return; const c = JSON.parse(JSON.stringify(d)) as GameConfig; c.solo.pits[pit].stages[lvl] = JSON.parse(JSON.stringify(c.solo.pits[pit].stages[lvl - 1])); setD(c); };
  const power = stage.deck.reduce((t, [id, l]) => { const def = d.cards.find((x) => x.id === id); if (!def) return t; const r = resolveCard(def, l, d); return t + r.hp + r.shield + r.atk * 3; }, 0);
  return (
    <div className="box">
      <div className="pits">
        {d.solo.pits.map((_, i) => <button key={i} className="pit" aria-selected={pit === i} onClick={() => { setPit(i); setLvl(0); }}>گودال {fa(i + 1)}</button>)}
      </div>
      <div className="levels adminlv">
        {d.solo.pits[pit].stages.map((_, i) => <button key={i} className={`lvl ${lvl === i ? 'cur' : ''}`} onClick={() => setLvl(i)}><b className="num">{fa(i + 1)}</b></button>)}
      </div>
      <h3>گودال {fa(pit + 1)} — لول {fa(lvl + 1)} <small>قدرت کل حریف ≈ {fa(power)}</small></h3>
      <div className="fgrid">
        {stage.deck.map(([id, l], i) => (
          <div key={i} className="giftbox">
            <label className="field">کارت {fa(i + 1)}
              <select value={id} onChange={(e) => edit((s) => { s.deck[i][0] = e.target.value; })}>
                {d.cards.map((c) => <option key={c.id} value={c.id}>{c.name} ({RARITY_FA[c.rarity]})</option>)}
              </select>
            </label>
            <label className="field">لول کارت
              <input type="number" min={1} max={d.upgrade.maxLevel} value={l} onChange={(e) => edit((s) => { s.deck[i][1] = Math.max(1, Math.min(d.upgrade.maxLevel, Number(e.target.value) || 1)); })} />
            </label>
          </div>
        ))}
      </div>
      <label className="field" style={{ maxWidth: 260 }}>هوش ربات در انتخاب هدف
        <select value={stage.ai} onChange={(e) => edit((s) => { s.ai = e.target.value as 'random' | 'smart'; })}>
          <option value="random">ساده (هدف رندوم)</option><option value="smart">هوشمند (ضعیف‌ترین یا خطرناک‌ترین)</option>
        </select>
      </label>
      <div className="btns">
        <button className="btn" onClick={() => run(async () => refresh((await call('/api/admin/config', { config: d })) as GameConfig), 'ذخیره شد و همین الان اعمال شد')}>ذخیره و اعمال</button>
        {lvl > 0 && <button className="btn ghost" onClick={copyPrev}>کپی از لول قبل</button>}
      </div>
    </div>
  );
}

function LookTab({ cfg, refresh, run }: TabProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const banner = cfg.ui?.banner;
  const upload = async (f: File | undefined) => {
    if (!f) return;
    await run(async () => {
      const blob = await shrink(f, 1400);
      const r = await fetch('/api/admin/banner', { method: 'POST', headers: { 'x-init-data': initData, 'content-type': blob.type }, body: blob });
      const j = await r.json(); if (!r.ok) throw new Error(j.error); refresh(j as GameConfig);
    }, 'بنر عوض شد');
    if (fileRef.current) fileRef.current.value = '';
  };
  return (
    <div className="box">
      <h3>بنر صفحه‌ی اصلی</h3>
      <small className="hint" style={{ textAlign: 'start' }}>این عکس به‌جای نوشته‌ی «میراث» بالای منوی بازی نشان داده می‌شود. اندازه‌ی پیشنهادی: عریض، مثلاً ۱۲۰۰×۴۰۰ (نسبت ۳ به ۱) با پس‌زمینه‌ی تیره یا شفاف (PNG/WebP).</small>
      <div className="bannerprev">
        {banner ? <img src={banner} alt="بنر" /> : <div className="brand">میراث</div>}
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void upload(e.target.files?.[0])} />
      <div className="btns">
        <button className="btn" onClick={() => fileRef.current?.click()}>{banner ? 'تغییر بنر' : 'آپلود بنر'}</button>
        {banner && <button className="btn ghost" onClick={() => run(async () => refresh(await call('/api/admin/banner/delete', {})), 'بنر حذف شد و نوشته‌ی پیش‌فرض برگشت')}>حذف بنر</button>}
      </div>
    </div>
  );
}

function PlayersTab({ cfg, run }: { cfg: GameConfig; run: Run }) {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [gift, setGift] = useState<AdminUser | null>(null);
  const [g, setG] = useState({ coins: 0, xp: 0, cardId: '' });
  const load = () => run(async () => { setUsers((await call(`/api/admin/users?q=${encodeURIComponent(q)}`)).users); });
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);
  return (
    <div className="box">
      <form className="searchrow" onSubmit={(e) => { e.preventDefault(); void load(); }}>
        <label className="field" style={{ flex: 1 }}>جستجو (نام یا شناسه‌ی تلگرام)<input value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <button className="btn">جستجو</button>
      </form>
      <div className="tblwrap"><table>
        <thead><tr><th>نام</th><th>شناسه</th><th>لول</th><th>برد / باخت</th><th>سکه</th><th></th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name} {u.banned ? <span className="tag bad">مسدود</span> : null}</td><td className="num">{u.tg_id}</td><td>{fa(u.level)}</td>
              <td>{fa(u.wins)} / {fa(u.losses)}</td><td>{fa(u.coins)}</td>
              <td className="acts">
                <button className="btn ghost" onClick={() => { setGift(u); setG({ coins: 0, xp: 0, cardId: '' }); }}>هدیه</button>
                <button className="btn ghost" onClick={() => run(async () => { await call('/api/admin/ban', { userId: u.id, banned: !u.banned }); await load(); }, u.banned ? 'رفع مسدودی شد' : 'مسدود شد')}>{u.banned ? 'رفع مسدودی' : 'مسدود'}</button>
              </td>
            </tr>
          ))}
          {users.length === 0 && <tr><td colSpan={6}>بازیکنی پیدا نشد</td></tr>}
        </tbody>
      </table></div>
      {gift && (
        <div className="giftbox">
          <b>هدیه برای {gift.name}</b>
          <div className="fgrid">
            <label className="field">سکه (می‌تواند منفی باشد)<input type="number" value={g.coins} onChange={(e) => setG({ ...g, coins: Number(e.target.value) })} /></label>
            <label className="field">XP<input type="number" min={0} value={g.xp} onChange={(e) => setG({ ...g, xp: Number(e.target.value) })} /></label>
            <label className="field">یک کارت
              <select value={g.cardId} onChange={(e) => setG({ ...g, cardId: e.target.value })}>
                <option value="">— هیچ —</option>{cfg.cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <div className="btns">
            <button className="btn" onClick={() => run(async () => { await call('/api/admin/gift', { userId: gift.id, ...g }); setGift(null); await load(); }, 'هدیه داده شد')}>ارسال هدیه</button>
            <button className="btn ghost" onClick={() => setGift(null)}>انصراف</button>
          </div>
        </div>
      )}
    </div>
  );
}

function JsonTab({ cfg, refresh, run }: TabProps) {
  const [text, setText] = useState(() => JSON.stringify(cfg, null, 2));
  return (
    <div className="box">
      <div className="warn">ویرایش مستقیم کل تنظیمات بازی (مرحله‌های سولو، ترکیب اولیه، جدول XP و …). قبل از ذخیره، همه‌چیز اعتبارسنجی می‌شود و در صورت خطا چیزی تغییر نمی‌کند.</div>
      <textarea className="json" dir="ltr" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="btns">
        <button className="btn" onClick={() => run(async () => {
          let parsed: unknown; try { parsed = JSON.parse(text); } catch { throw new Error('JSON درست نیست (ویرگول یا گیومه‌ی جا افتاده؟)'); }
          const next = (await call('/api/admin/config', { config: parsed })) as GameConfig; refresh(next); setText(JSON.stringify(next, null, 2));
        }, 'ذخیره شد و اعمال شد')}>ذخیره و اعمال</button>
        <button className="btn ghost" onClick={() => run(async () => { const c = await loadConfig(); setText(JSON.stringify(c, null, 2)); }, 'از سرور بازخوانی شد')}>بازخوانی</button>
      </div>
    </div>
  );
}
