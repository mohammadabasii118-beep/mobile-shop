import { useEffect, useRef, useState } from 'react';
import { ABILITY_META, BOX_TYPES, type BoxType, type CardDef, type GameConfig, type Profile, type Rarity } from '@game/shared';
import { resolveCard } from '@game/shared';
import type { Ctx } from './App';
import { call, loadConfig } from './net';
import { initData } from './telegram';
import { CardTile, Icon, Modal, RARITY_FA, fa } from './ui';

type Tab = 'cards' | 'eco' | 'shop' | 'solo' | 'look' | 'chat' | 'players' | 'json';
interface Stats { users: number; battles: number; pendingBoxes: number; coins: number; banned: number }
interface AdminUser { id: number; tg_id: number; name: string; avatar: string | null; level: number; coins: number; gems: number; wins: number; losses: number; banned: number }

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
        {([['cards', 'کارت‌ها و عکس‌ها'], ['eco', 'جعبه و اقتصاد'], ['shop', 'فروشگاه'], ['solo', 'تک‌نفره (گودال‌ها)'], ['look', 'ظاهر و بنر'], ['chat', 'چت'], ['players', 'بازیکن‌ها'], ['json', 'پیشرفته']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'cards' && <CardsTab cfg={cfg} refresh={refresh} run={run} />}
      {tab === 'eco' && <EcoTab cfg={cfg} refresh={refresh} run={run} />}
      {tab === 'shop' && <ShopTab cfg={cfg} refresh={refresh} run={run} />}
      {tab === 'solo' && <SoloTab cfg={cfg} refresh={refresh} run={run} />}
      {tab === 'chat' && <ChatTab cfg={cfg} refresh={refresh} run={run} />}
      {tab === 'look' && <LookTab cfg={cfg} refresh={refresh} run={run} />}
      {tab === 'players' && <PlayersTab cfg={cfg} run={run} />}
      {tab === 'json' && <JsonTab cfg={cfg} refresh={refresh} run={run} />}
    </div>
  );
}

/** ترتیب و رنگ نوع‌ها: ساده=برنزی، معمولی=نقره‌ای، کمیاب=طلایی */
const RARITIES: Rarity[] = ['common', 'rare', 'epic'];
const RARITY_TONE: Record<Rarity, string> = { common: 'bronze', rare: 'silver', epic: 'gold' };

type Run = <T>(f: () => Promise<T>, okText?: string) => Promise<T | undefined>;
interface TabProps { cfg: GameConfig; refresh: (c: GameConfig) => void; run: Run }

/**
 * کارت‌ها: فقط اسم، نوع و عکس از پنل ویرایش می‌شود.
 * آمار هر لول و توانایی‌ها بعد از بالانس نهایی توسط توسعه‌دهنده در تنظیمات گذاشته می‌شود (و با «پیشرفته» هم قابل ویرایش است).
 */
function CardsTab({ cfg, refresh, run }: TabProps) {
  const [sel, setSel] = useState<string | undefined>(cfg.cards[0]?.id);
  const [draft, setDraft] = useState<CardDef | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const saved = cfg.cards.find((c) => c.id === sel);
  useEffect(() => { setDraft(saved ? { ...saved } : null); }, [sel, cfg]);
  if (!draft) return <p className="hint">کارتی نیست.</p>;
  const set = (p: Partial<CardDef>) => setDraft({ ...draft, ...p });
  const dirty = !!saved && (saved.name !== draft.name || saved.rarity !== draft.rarity || (saved.chargeAttacks ?? 0) !== (draft.chargeAttacks ?? 0));

  const save = () => run(async () => {
    refresh(await call('/api/admin/card', { card: { ...saved!, name: draft.name, rarity: draft.rarity, chargeAttacks: Math.max(0, Math.min(20, Math.round(draft.chargeAttacks ?? 0))) } }));
  }, 'ذخیره شد و همین الان در بازی اعمال شد');
  const upload = async (f: File | undefined) => {
    if (!f) return;
    await run(async () => {
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
            <button key={c.id} aria-pressed={sel === c.id} onClick={() => setSel(c.id)}>
              <span>{c.name}</span><span className={`rar ${c.rarity}`}>{RARITY_FA[c.rarity]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="box">
        <h3>«{saved?.name}»</h3>
        <div className="picrow">
          <div className="pic-prev"><CardTile def={draft} level={1} hp={draft.hp} atk={draft.atk} shield={draft.shield} /></div>
          <div className="picctl">
            <b>عکس کارت</b>
            <small>PNG، JPG یا WebP. مربعی بهتر است؛ خودکار کوچک می‌شود.</small>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void upload(e.target.files?.[0])} />
            <div className="btns">
              <button className="btn" onClick={() => fileRef.current?.click()}>{draft.image ? 'تغییر عکس' : 'آپلود عکس'}</button>
              {draft.image && <button className="btn ghost" onClick={() => run(async () => refresh(await call('/api/admin/card-image/delete', { cardId: draft.id })), 'عکس حذف شد')}>حذف عکس</button>}
            </div>
          </div>
        </div>
        <div className="fgrid">
          <label className="field">نام<input value={draft.name} onChange={(e) => set({ name: e.target.value })} /></label>
          <label className="field">نوع کارت
            <select value={draft.rarity} onChange={(e) => set({ rarity: e.target.value as Rarity })}>
              {RARITIES.map((r) => <option key={r} value={r}>{RARITY_FA[r]}</option>)}
            </select>
          </label>
          <label className="field">قدرت ویژه: بعد از چند حمله؟ (۰ = ندارد)
            <input type="number" min={0} max={20} value={draft.chargeAttacks ?? 0} onChange={(e) => set({ chargeAttacks: e.target.value === '' ? 0 : Number(e.target.value) })} />
          </label>
        </div>
        <small className="hint" style={{ textAlign: 'start' }}>بعد از این‌همه حمله نوار قرمز کارت پر می‌شود و حمله‌ی بعدی همه‌ی توانایی‌های کارت ۲ برابر می‌شود (برای کارتِ بدون توانایی اثری ندارد).</small>
        <div className="btns"><button className="btn" disabled={!dirty} onClick={save}>ذخیره و اعمال</button></div>

        <h3>مسیر قدرت‌گیری <small>فقط نمایش؛ آمار هر لول از تنظیمات بازی خوانده می‌شود</small></h3>
        <div className="evo">
          {Array.from({ length: cfg.upgrade.maxLevel }, (_, i) => {
            const s = resolveCard(draft, i + 1);
            const need = cfg.upgrade.byRarity[draft.rarity][i - 1];
            return (
              <div key={i}>
                <CardTile def={draft} level={i + 1} maxLevel={cfg.upgrade.maxLevel} hp={s.hp} atk={s.atk} shield={s.shield} />
                <span>{i === 0 ? 'پایه' : `${fa(need.copies)} کارت + ${fa(need.coins)}`}</span>
              </div>
            );
          })}
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
  const [ur, setUr] = useState<Rarity>('common');
  const urows = d.upgrade.byRarity[ur];
  const total = urows.reduce((s, l) => ({ c: s.c + l.copies, k: s.k + l.coins, x: s.x + (l.xp ?? 0) }), { c: 0, k: 0, x: 0 });
  const [bt, setBt] = useState<BoxType>('bronze');
  const [dm, setDm] = useState<'solo' | 'multi'>('solo');
  const [cm, setCm] = useState<'solo' | 'multi'>('solo');
  const dropSum = BOX_TYPES.reduce((t, k) => t + (Number(d.box.drops[dm][k]) || 0), 0);
  const box = d.box.types[bt];
  const ct = box.contents[cm];
  const cc = ct.cardChance;
  const upd = (fn: (c: GameConfig) => void) => { const c = JSON.parse(JSON.stringify(d)) as GameConfig; fn(c); setD(c); };
  /** حداکثر لول برای هر سه نوع کارت با هم عوض می‌شود؛ ردیف‌های جدید از آخرین ردیف دو برابر می‌شوند */
  const setMax = (m: number) => upd((c) => {
    c.upgrade.maxLevel = m;
    for (const r of RARITIES) {
      const rows = c.upgrade.byRarity[r];
      while (rows.length < m - 1) { const last = rows[rows.length - 1] ?? { copies: 2, coins: 50, xp: 10 }; rows.push({ copies: last.copies * 2, coins: last.coins * 2, xp: Math.round(last.xp * 1.5) }); }
      rows.length = Math.max(1, m - 1);
    }
  });
  return (
    <div className="cols">
      <div className="box">
        <h3>جعبه‌ها</h3>
        <div className="pits" role="tablist" aria-label="نوع جعبه">
          {BOX_TYPES.map((t) => (
            <button key={t} role="tab" aria-selected={bt === t} className={`pit boxtab ${t}`} onClick={() => setBt(t)}>{d.box.types[t].name}</button>
          ))}
        </div>
        <small className="hint" style={{ textAlign: 'start' }}>نوع جعبه را انتخاب کن؛ نام و زمان باز شدن برای هر دو حالت یکی است، ولی محتوا (سکه، تعداد و شانس کارت) برای جعبه‌ی تک‌نفره (دانجن) و آنلاین جدا تنظیم می‌شود.</small>
        <label className="field">نام نمایشی<input value={box.name} onChange={(e) => upd((c) => { c.box.types[bt].name = e.target.value; })} /></label>
        <div className="fgrid">
          {f('زمان باز شدن (ساعت)', box.durationSeconds / 3600, (x) => upd((c) => { c.box.types[bt].durationSeconds = Math.round(x * 3600); }), 0.25)}
        </div>
        <h3>محتوای جعبه‌ی {box.name}</h3>
        <div className="pits" role="tablist" aria-label="محتوای جعبه برای کدام حالت">
          {(['solo', 'multi'] as const).map((m) => (
            <button key={m} role="tab" aria-selected={cm === m} className="pit" onClick={() => setCm(m)}>{m === 'solo' ? 'تک‌نفره (دانجن)' : 'آنلاین'}</button>
          ))}
        </div>
        <small className="hint" style={{ textAlign: 'start' }}>این محتوا برای جعبه‌ای است که از {cm === 'solo' ? 'تک‌نفره (دانجن)' : 'بازی آنلاین'} به بازیکن می‌رسد.</small>
        <div className="fgrid">
          {f('سکه — حداقل', ct.coins[0], (x) => upd((c) => { c.box.types[bt].contents[cm].coins[0] = x; }))}
          {f('سکه — حداکثر', ct.coins[1], (x) => upd((c) => { c.box.types[bt].contents[cm].coins[1] = x; }))}
          {f('تعداد کارت — حداقل', ct.cardCountRange[0], (x) => upd((c) => { c.box.types[bt].contents[cm].cardCountRange[0] = x; }))}
          {f('تعداد کارت — حداکثر', ct.cardCountRange[1], (x) => upd((c) => { c.box.types[bt].contents[cm].cardCountRange[1] = x; }))}
        </div>
        <h3>شانس کارت — جعبه‌ی {box.name} ({cm === 'solo' ? 'تک‌نفره' : 'آنلاین'}) (٪)</h3>
        <div className="fgrid">
          {f('کمیاب (طلایی)', Math.round(cc.epic * 100), (x) => upd((c) => { c.box.types[bt].contents[cm].cardChance.epic = x / 100; }))}
          {f('معمولی (نقره‌ای)', Math.round(cc.rare * 100), (x) => upd((c) => { c.box.types[bt].contents[cm].cardChance.rare = x / 100; }))}
          {f('ساده (برنزی)', Math.round(cc.common * 100), (x) => upd((c) => { c.box.types[bt].contents[cm].cardChance.common = x / 100; }))}
        </div>
        <small className="hint">شانس بدون کارت: {fa(Math.round((1 - cc.epic - cc.rare - cc.common) * 100))}٪ (برای هر کارتِ جعبه جدا انداخته می‌شود)</small>
        <h3>باز کردن فوری با الماس</h3>
        <small className="hint" style={{ textAlign: 'start' }}>برای هر چند دقیقه‌ی باقی‌مانده (رو به بالا گرد می‌شود) چند الماس؟ مثلاً با ۲ الماس برای هر ۱۰ دقیقه: ۱۲ دقیقه مانده = ۲ پله = ۴ الماس، ۲۵ دقیقه = ۶ الماس، جعبه‌ی ۱ ساعته = ۱۲ الماس.</small>
        <div className="fgrid">
          {f('الماس برای هر پله', d.box.speedup.gemsPerStep, (x) => upd((c) => { c.box.speedup.gemsPerStep = x; }))}
          {f('طول هر پله (دقیقه)', d.box.speedup.stepMinutes, (x) => upd((c) => { c.box.speedup.stepMinutes = Math.max(1, x); }))}
        </div>
        <h3>تعداد اسلات جعبه</h3>
        <div className="fgrid">{f('اسلات', d.box.slots, (x) => upd((c) => { c.box.slots = x; }))}</div>
        <h3>هزینه‌ی ورود به نبرد (سکه)</h3>
        <div className="fgrid">
          {f('هر مرحله‌ی تک‌نفره', d.fees?.solo ?? 0, (x) => upd((c) => { c.fees = { solo: x, multi: c.fees?.multi ?? 0 }; }))}
          {f('ورود به مولتی‌پلیر', d.fees?.multi ?? 0, (x) => upd((c) => { c.fees = { solo: c.fees?.solo ?? 0, multi: x }; }))}
        </div>
        <h3>نبرد</h3>
        <div className="fgrid">
          {f('مهلت هر نوبت (ثانیه)', d.turnSeconds, (x) => upd((c) => { c.turnSeconds = x; }))}
          {f('حداکثر کارت ترکیب (۳ تا ۵)', d.deckSize, (x) => upd((c) => { c.deckSize = Math.max(3, Math.min(5, Math.round(x))); }))}
          {f('سقف دور (مخفی)', d.maxRounds, (x) => upd((c) => { c.maxRounds = x; }))}
        </div>
      </div>
      <div className="box">
        <h3>شانس دریافت جعبه با هر برد</h3>
        <small className="hint" style={{ textAlign: 'start' }}>برای هر حالت، با هر برد کدام جعبه به بازیکن می‌رسد؟ عددها درصدند و مجموعشان حداکثر ۱۰۰ است؛ باقی‌مانده یعنی «این بار جعبه‌ای نمی‌آید».</small>
        <div className="pits" role="tablist" aria-label="حالت بازی">
          {(['solo', 'multi'] as const).map((m) => (
            <button key={m} role="tab" aria-selected={dm === m} className="pit" onClick={() => setDm(m)}>{m === 'solo' ? 'تک‌نفره' : 'آنلاین'}</button>
          ))}
        </div>
        <div className="fgrid">
          {BOX_TYPES.map((t) => f(`شانس جعبه‌ی ${d.box.types[t].name} (٪)`, d.box.drops[dm][t], (x) => upd((c) => { c.box.drops[dm][t] = x; })))}
        </div>
        <div className={`dropsum ${dropSum > 100 ? 'bad' : ''}`}>
          <span>مجموع: <b className="num">{fa(dropSum)}٪</b></span>
          <span>بدون جعبه: <b className="num">{fa(Math.max(0, 100 - dropSum))}٪</b></span>
        </div>
        {dropSum > 100 && <div className="warn">مجموع بیشتر از ۱۰۰٪ است؛ ذخیره نمی‌شود.</div>}
        <button className="btn" disabled={dropSum > 100} onClick={() => run(async () => refresh((await call('/api/admin/config', { config: d })) as GameConfig), 'ذخیره شد و اعمال شد')}>ذخیره و اعمال</button>
      </div>
      <div className="box">
        <h3>هزینه‌ی ارتقا</h3>
        <div className="pits" role="tablist" aria-label="نوع کارت">
          {RARITIES.map((r) => (
            <button key={r} role="tab" aria-selected={ur === r} className={`pit boxtab ${RARITY_TONE[r]}`} onClick={() => setUr(r)}>{RARITY_FA[r]}</button>
          ))}
        </div>
        <small className="hint" style={{ textAlign: 'start' }}>نوع کارت را انتخاب کن؛ هزینه‌ی ارتقای همین نوع در جدول زیر ویرایش می‌شود.</small>
        {f('حداکثر لول کارت (برای هر سه نوع)', d.upgrade.maxLevel, setMax)}
        <div className="tblwrap"><table>
          <thead><tr><th>از لول</th><th>تعداد کارت</th><th>سکه</th><th>XP دریافتی</th></tr></thead>
          <tbody>{urows.map((l, i) => (
            <tr key={i}><td>{fa(i + 1)} ← {fa(i + 2)}</td>
              <td><input className="cell" type="number" min={1} value={l.copies} onChange={(e) => upd((c) => { c.upgrade.byRarity[ur][i].copies = n(e.target.value); })} /></td>
              <td><input className="cell" type="number" min={0} value={l.coins} onChange={(e) => upd((c) => { c.upgrade.byRarity[ur][i].coins = n(e.target.value); })} /></td>
              <td><input className="cell" type="number" min={0} value={l.xp} onChange={(e) => upd((c) => { c.upgrade.byRarity[ur][i].xp = n(e.target.value); })} /></td></tr>
          ))}</tbody>
        </table></div>
        <small className="hint">رساندن یک کارت {RARITY_FA[ur]} تا لول آخر: {fa(total.c)} کارت (تعداد)، {fa(total.k)} سکه و {fa(total.x)} XP برای بازیکن</small>
        <button className="btn" onClick={() => run(async () => refresh((await call('/api/admin/config', { config: d })) as GameConfig), 'ذخیره شد و اعمال شد')}>ذخیره و اعمال</button>
      </div>
      <div className="box">
        <h3>جایزه‌ی نبرد آنلاین</h3>
        <small className="hint" style={{ textAlign: 'start' }}>XP فقط از دو راه می‌آید: ارتقای کارت و برد آنلاین. جعبه‌ها XP نمی‌دهند. تک‌نفره فقط جعبه می‌دهد (طبق «شانس جعبه»).</small>
        <div className="fgrid">
          {f('سکه‌ی هر برد', d.online.winCoins, (x) => upd((c) => { c.online.winCoins = x; }))}
          {f('XP هر برد', d.online.winXp, (x) => upd((c) => { c.online.winXp = x; }))}
          {f('کاپِ هر برد (+)', d.online.trophiesWin, (x) => upd((c) => { c.online.trophiesWin = x; }))}
          {f('کاپِ هر باخت (−)', d.online.trophiesLoss, (x) => upd((c) => { c.online.trophiesLoss = x; }))}
        </div>
        <button className="btn" onClick={() => run(async () => refresh((await call('/api/admin/config', { config: d })) as GameConfig), 'ذخیره شد و اعمال شد')}>ذخیره و اعمال</button>
      </div>
    </div>
  );
}

interface AdminOrder { id: number; userId: number; tgId: number; name: string; avatar: string | null; gems: number; coins: number; toman: number; stars: number; method: string; note: string | null; status: string; createdAt: number; doneAt: number | null }
const ORDER_FA: Record<string, string> = { pending: 'در انتظار', delivered: 'تحویل شد', canceled: 'لغو شد' };

/** فروشگاه: ۶ پیشنهاد کارت روزانه، بسته‌های سکه (با الماس) و الماس (با تومان)، آدرس درگاه، و سفارش‌ها */
function ShopTab({ cfg, refresh, run }: TabProps) {
  const [d, setD] = useState<GameConfig>(() => JSON.parse(JSON.stringify(cfg)));
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [only, setOnly] = useState<'pending' | 'all'>('pending');
  const n = (v: string) => (v === '' ? 0 : Math.max(0, Math.floor(Number(v))));
  const upd = (fn: (c: GameConfig) => void) => { const c = JSON.parse(JSON.stringify(d)) as GameConfig; fn(c); setD(c); };
  const loadOrders = () => run(async () => { setOrders((await call('/api/admin/orders')).orders); });
  useEffect(() => { void loadOrders(); /* eslint-disable-next-line */ }, []);
  const saveShop = () => run(async () => refresh((await call('/api/admin/config', { config: d })) as GameConfig), 'فروشگاه ذخیره شد');
  const when = (t: number) => new Date(t).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
  const act = (id: number, action: 'deliver' | 'cancel') => run(async () => { setOrders((await call('/api/admin/order', { id, action })).orders); }, action === 'deliver' ? 'به حساب بازیکن اضافه شد' : 'سفارش لغو شد');
  const shown = orders.filter((o) => only === 'all' || o.status === 'pending');
  const num = (label: string, v: number, on: (x: number) => void) => <label className="field">{label}<input type="number" min={0} value={v} onChange={(e) => on(n(e.target.value))} /></label>;

  return (
    <div className="cols">
      <div className="box">
        <h3>پیشنهاد روزانه (۶ کارت)</h3>
        <small className="hint" style={{ textAlign: 'start' }}>هر اسلات: کارت، تعداد، و فقط یک قیمت (اول ارز را انتخاب کن: الماس یا سکه؛ فقط همان در فروشگاه نمایش داده می‌شود). هر بازیکن هر پیشنهاد را روزی یک‌بار می‌تواند بخرد (بازنشانی نیمه‌شب تهران). با عوض‌کردن اسلات، همان لحظه دوباره قابل خرید می‌شود. اسلات «خاموش» نمایش داده نمی‌شود.</small>
        {d.shop.cards.map((o, i) => (
          <div key={i} className="giftbox">
            <b>اسلات {fa(i + 1)}</b>
            <div className="fgrid">
              <label className="field">کارت
                <select value={o.cardId} onChange={(e) => upd((c) => { c.shop.cards[i].cardId = e.target.value; })}>
                  <option value="">— خاموش —</option>
                  {d.cards.map((c) => <option key={c.id} value={c.id}>{c.name} ({RARITY_FA[c.rarity]})</option>)}
                </select>
              </label>
              {num('تعداد', o.count, (x) => upd((c) => { c.shop.cards[i].count = Math.max(1, x); }))}
              <label className="field">قیمت با
                <select value={o.currency} onChange={(e) => upd((c) => { c.shop.cards[i].currency = e.target.value as 'gems' | 'coins'; })}>
                  <option value="gems">الماس</option><option value="coins">سکه</option>
                </select>
              </label>
              {num(`قیمت (${o.currency === 'gems' ? 'الماس' : 'سکه'})`, o.price, (x) => upd((c) => { c.shop.cards[i].price = Math.max(1, x); }))}
            </div>
          </div>
        ))}
        <button className="btn" onClick={() => void saveShop()}>ذخیره و اعمال</button>
      </div>

      <div className="box">
        <h3>باکس سکه</h3>
        <small className="hint" style={{ textAlign: 'start' }}>هر بسته یا با الماس فروخته می‌شود (فوری) یا با تومان (کارت‌به‌کارت؛ مثل خرید الماس، سفارش در بخش پایین می‌آید و تو تحویل می‌دهی). فقط همان یک قیمت نمایش داده می‌شود. بسته‌های تومانی تا وقتی کارت‌به‌کارت را فعال نکرده‌ای نمایش داده نمی‌شوند.</small>
        {d.shop.coinPacks.map((k, i) => (
          <div key={k.id} className="giftbox">
            <div className="fgrid">
              {num('مقدار سکه', k.coins, (x) => upd((c) => { c.shop.coinPacks[i].coins = Math.max(1, x); }))}
              <label className="field">فروش با
                <select value={k.currency} onChange={(e) => upd((c) => { c.shop.coinPacks[i].currency = e.target.value as 'gems' | 'toman'; })}>
                  <option value="gems">الماس (فوری)</option><option value="toman">تومان (کارت‌به‌کارت)</option>
                </select>
              </label>
              {num(`قیمت (${k.currency === 'gems' ? 'الماس' : 'تومان'})`, k.price, (x) => upd((c) => { c.shop.coinPacks[i].price = Math.max(1, x); }))}
            </div>
            <button className="btn ghost neg" onClick={() => upd((c) => { c.shop.coinPacks.splice(i, 1); })}>حذف</button>
          </div>
        ))}
        <button className="btn ghost" disabled={d.shop.coinPacks.length >= 12} onClick={() => upd((c) => { c.shop.coinPacks.push({ id: `c${Date.now().toString(36)}`, coins: 1000, currency: 'gems', price: 20 }); })}>+ بسته‌ی سکه</button>

        <h3>خرید الماس (تومان / استار)</h3>
        <small className="hint" style={{ textAlign: 'start' }}>برای هر بسته می‌توانی هر دو قیمت را بگذاری یا یکی را ۰ کنی (۰ = با آن روش نمی‌شود خرید). هر بسته حداقل یک قیمت لازم دارد.</small>
        {d.shop.gemPacks.map((k, i) => (
          <div key={k.id} className="giftbox">
            <div className="fgrid">
              {num('مقدار الماس', k.gems, (x) => upd((c) => { c.shop.gemPacks[i].gems = Math.max(1, x); }))}
              {num('قیمت (تومان) — کارت‌به‌کارت', k.toman, (x) => upd((c) => { c.shop.gemPacks[i].toman = x; }))}
              {num('قیمت (استار تلگرام)', k.stars, (x) => upd((c) => { c.shop.gemPacks[i].stars = Math.min(10000, x); }))}
            </div>
            <button className="btn ghost neg" onClick={() => upd((c) => { c.shop.gemPacks.splice(i, 1); })}>حذف</button>
          </div>
        ))}
        <button className="btn ghost" disabled={d.shop.gemPacks.length >= 12} onClick={() => upd((c) => { c.shop.gemPacks.push({ id: `g${Date.now().toString(36)}`, gems: 100, toman: 90000, stars: 250 }); })}>+ بسته‌ی الماس</button>
        <button className="btn" onClick={() => void saveShop()}>ذخیره و اعمال</button>
      </div>

      <div className="box">
        <h3>روش‌های پرداخت</h3>
        <label className="check"><input type="checkbox" checked={d.shop.card.enabled} onChange={(e) => upd((c) => { c.shop.card.enabled = e.target.checked; })} /> کارت‌به‌کارت (تحویل دستی)</label>
        <div className="fgrid">
          <label className="field">شماره‌ی کارت<input dir="ltr" inputMode="numeric" value={d.shop.card.number} onChange={(e) => upd((c) => { c.shop.card.number = e.target.value; })} placeholder="6037 9912 3456 7890" /></label>
          <label className="field">به نام<input value={d.shop.card.holder} maxLength={60} onChange={(e) => upd((c) => { c.shop.card.holder = e.target.value; })} /></label>
          <label className="field">بانک<input value={d.shop.card.bank} maxLength={40} onChange={(e) => upd((c) => { c.shop.card.bank = e.target.value; })} /></label>
        </div>
        <small className="hint" style={{ textAlign: 'start' }}>بازیکن مشخصات کارت را می‌بیند، واریز می‌کند، کد پیگیری را می‌نویسد و سفارش پایین می‌آید. تو پرداخت را در اپ بانکت چک می‌کنی و «تحویل» را می‌زنی.</small>
        <label className="check"><input type="checkbox" checked={d.shop.starsEnabled} onChange={(e) => upd((c) => { c.shop.starsEnabled = e.target.checked; })} /> استار تلگرام (خودکار)</label>
        <small className="hint" style={{ textAlign: 'start' }}>با استار، پرداخت داخل خود تلگرام انجام می‌شود و الماس همان لحظه خودکار اضافه می‌شود (نیازی به تحویل دستی نیست). فقط وقتی کار می‌کند که ربات روشن و توکن درست باشد. استارهای دریافتی در حساب ربات جمع می‌شوند.</small>
        <button className="btn" onClick={() => void saveShop()}>ذخیره و اعمال</button>
      </div>

      <div className="box">
        <h3>سفارش‌های خرید الماس</h3>
        <div className="tabs" role="tablist" aria-label="فیلتر سفارش‌ها">
          <button role="tab" aria-selected={only === 'pending'} onClick={() => setOnly('pending')}>در انتظار ({fa(orders.filter((o) => o.status === 'pending').length)})</button>
          <button role="tab" aria-selected={only === 'all'} onClick={() => setOnly('all')}>همه</button>
          <button onClick={() => void loadOrders()}>↻ تازه‌سازی</button>
        </div>
        {shown.map((o) => (
          <div key={o.id} className="giftbox">
            <div className="who"><Av url={o.avatar} name={o.name} /> <b>{o.name}</b> <span className={`tag ${o.status === 'pending' ? '' : o.status === 'delivered' ? 'ok' : 'bad'}`}>{ORDER_FA[o.status] ?? o.status}</span></div>
            <small>شناسه‌ی تلگرام: <b className="num">{o.tgId}</b> · شناسه‌ی بازی: <b className="num">{fa(o.userId)}</b></small>
            <small>خرید: <b className="num">{o.coins > 0 ? `${fa(o.coins)} سکه` : `${fa(o.gems)} الماس`}</b> — {o.method === 'stars' ? `${fa(o.stars)} استار (تلگرام، خودکار)` : `${fa(o.toman)} تومان (کارت‌به‌کارت)`} · سفارش #{fa(o.id)}</small>
            {o.note && <small>کد پیگیری بازیکن: <b className="num">{o.note}</b></small>}
            <small>تاریخ ثبت: {when(o.createdAt)}{o.doneAt ? ` · بررسی: ${when(o.doneAt)}` : ''}</small>
            {o.status === 'pending' && (
              <div className="row">
                {o.method === 'card' && <button className="btn ghost pos" onClick={() => void act(o.id, 'deliver')}>تحویل (+{o.coins > 0 ? `${fa(o.coins)} سکه` : `${fa(o.gems)} الماس`})</button>}
                <button className="btn ghost neg" onClick={() => void act(o.id, 'cancel')}>لغو</button>
              </div>
            )}
          </div>
        ))}
        {shown.length === 0 && <small className="hint">سفارشی نیست.</small>}
      </div>
    </div>
  );
}

/** ویرایش حریف هر لول سولو: ۳ تا ۵ کارت (با لول) و هوش ربات */
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
      <div className="btns">
        {stage.deck.length < d.deckSize && <button className="btn ghost" onClick={() => edit((s) => { s.deck.push([s.deck[s.deck.length - 1][0], s.deck[s.deck.length - 1][1]]); })}>+ افزودن کارت</button>}
        {stage.deck.length > 3 && <button className="btn ghost" onClick={() => edit((s) => { s.deck.pop(); })}>− حذف آخرین کارت</button>}
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
  const bgRef = useRef<HTMLInputElement>(null);
  const uploadBg = async (f: File | undefined) => {
    if (!f) return;
    await run(async () => {
      const blob = await shrink(f, 1800);
      const r = await fetch('/api/admin/background', { method: 'POST', headers: { 'x-init-data': initData, 'content-type': blob.type }, body: blob });
      const j = await r.json(); if (!r.ok) throw new Error(j.error); refresh(j as GameConfig);
    }, 'پس‌زمینه عوض شد');
    if (bgRef.current) bgRef.current.value = '';
  };
  const [welcome, setWelcome] = useState(cfg.ui?.welcome ?? '');
  const [chUser, setChUser] = useState(cfg.channel?.username ?? 'MirasGame');
  const [chReq, setChReq] = useState(cfg.channel?.required ?? true);
  const saveWelcome = (text: string) => run(async () => {
    const next = { ...cfg, ui: { ...cfg.ui } };
    if (text.trim()) next.ui.welcome = text; else delete next.ui.welcome;
    refresh((await call('/api/admin/config', { config: next })) as GameConfig);
  }, text.trim() ? 'متن پیام اول ذخیره شد' : 'متن پیش‌فرض برگشت');
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
      <h3>پس‌زمینه‌ی بازی</h3>
      <small className="hint" style={{ textAlign: 'start' }}>عکس پس‌زمینه‌ی همه‌ی صفحه‌های بازی. عکس عمودی (مثل موبایل)، مثلاً ۱۰۸۰×۱۹۲۰. اگر نگذاری، پس‌زمینه‌ی پیش‌فرض (آسمان شب و گنبدها) استفاده می‌شود.</small>
      <div className="bgprev" style={cfg.ui?.background ? { backgroundImage: `url(${cfg.ui.background})` } : undefined}>{cfg.ui?.background ? '' : 'پیش‌فرض'}</div>
      <input ref={bgRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void uploadBg(e.target.files?.[0])} />
      <div className="btns">
        <button className="btn" onClick={() => bgRef.current?.click()}>{cfg.ui?.background ? 'تغییر پس‌زمینه' : 'آپلود پس‌زمینه'}</button>
        {cfg.ui?.background && <button className="btn ghost" onClick={() => run(async () => refresh(await call('/api/admin/background/delete', {})), 'پس‌زمینه‌ی پیش‌فرض برگشت')}>حذف (برگشت به پیش‌فرض)</button>}
      </div>
      <h3>عضویت اجباری کانال</h3>
      <small className="hint" style={{ textAlign: 'start' }}>بازیکن قبل از بازی باید عضو این کانال باشد (فقط یک‌بار بررسی می‌شود). ربات باید ادمین کانال باشد. ادمین‌های بازی از این شرط معافند.</small>
      <div className="fgrid">
        <label className="field">آیدی کانال (بدون @)<input dir="ltr" value={chUser} onChange={(e) => setChUser(e.target.value.replace(/[^A-Za-z0-9_]/g, ''))} /></label>
        <label className="field">وضعیت
          <select value={chReq ? 'on' : 'off'} onChange={(e) => setChReq(e.target.value === 'on')}><option value="on">اجباری</option><option value="off">غیرفعال</option></select>
        </label>
      </div>
      <div className="btns"><button className="btn" onClick={() => run(async () => refresh((await call('/api/admin/config', { config: { ...cfg, channel: { username: chUser, required: chReq } } })) as GameConfig), 'تنظیم کانال ذخیره شد')}>ذخیره</button></div>
      <h3>پیام اول ربات (/start)</h3>
      <small className="hint" style={{ textAlign: 'start' }}>این متن وقتی کسی به ربات «/start» می‌زند همراه دکمه‌ی «ورود به بازی» فرستاده می‌شود. اگر خالی بگذاری، متن پیش‌فرض استفاده می‌شود. حداکثر ۳۵۰۰ نویسه.</small>
      <textarea className="json welcome" value={welcome} onChange={(e) => setWelcome(e.target.value)} placeholder="خالی = متن پیش‌فرض" rows={12} />
      <div className="btns">
        <button className="btn" onClick={() => void saveWelcome(welcome)}>ذخیره‌ی متن</button>
        <button className="btn ghost" onClick={() => { setWelcome(''); void saveWelcome(''); }}>بازگشت به متن پیش‌فرض</button>
      </div>
    </div>
  );
}

/** عکس پروفایل (از تلگرام) یا حرف اول اسم */
function Av({ url, name, big }: { url: string | null; name: string; big?: boolean }) {
  const [bad, setBad] = useState(false);
  const cls = `avatar ${big ? 'big' : 'small'}`;
  return url && !bad ? <img className={cls} src={url} alt="" onError={() => setBad(true)} referrerPolicy="no-referrer" /> : <span className={`${cls} ph`}>{[...name][0] ?? '؟'}</span>;
}

type Detail = Profile & { tgId: number; banned: boolean; createdAt: number };

function soloText(cfg: GameConfig, cleared: number) {
  const total = cfg.solo.pits.reduce((t, p) => t + p.stages.length, 0);
  if (cleared >= total) return `همه‌ی ${fa(total)} لول تمام شده`;
  let g = cleared;
  for (let pi = 0; pi < cfg.solo.pits.length; pi++) {
    const n = cfg.solo.pits[pi].stages.length;
    if (g < n) return `${fa(cleared)} از ${fa(total)} لول — الان در گودال ${fa(pi + 1)}، لول ${fa(g + 1)}`;
    g -= n;
  }
  return `${fa(cleared)} لول`;
}

/** پیام‌های آماده‌ی چت بازی آنلاین: افزودن، ویرایش، حذف؛ متن یا فقط ایموجی */
function ChatTab({ cfg, refresh, run }: TabProps) {
  const [list, setList] = useState<string[]>(() => [...(cfg.chatPhrases ?? [])]);
  const clean = list.map((x) => x.trim());
  const bad = clean.some((x) => !x || x.length > 24) || list.length > 16;
  const save = () => run(async () => {
    const d = JSON.parse(JSON.stringify(cfg)) as GameConfig;
    d.chatPhrases = clean;
    refresh((await call('/api/admin/config', { config: d })) as GameConfig);
  }, 'ذخیره شد و همین الان اعمال شد');
  return (
    <div className="box">
      <h3>پیام‌های آماده‌ی چت <small>(بازی آنلاین، حداکثر ۱۶ پیام)</small></h3>
      <small className="hint" style={{ textAlign: 'start' }}>هر پیام می‌تواند متن کوتاه یا فقط یک ایموجی باشد (مثلاً 👍 یا 😂). بازیکن با زدن هر کدام، آن را برای حریف نشان می‌دهد.</small>
      {list.map((x, i) => (
        <div key={i} className="row" style={{ justifyContent: 'stretch' }}>
          <input style={{ flex: 1 }} maxLength={24} value={x} onChange={(e) => setList(list.map((y, j) => (j === i ? e.target.value : y)))} />
          <button className="btn ghost" aria-label="حذف" onClick={() => setList(list.filter((_, j) => j !== i))}>🗑</button>
        </div>
      ))}
      <div className="btns">
        {list.length < 16 && <button className="btn ghost" onClick={() => setList([...list, ''])}>+ پیام جدید</button>}
        <button className="btn" disabled={bad} onClick={save}>ذخیره و اعمال</button>
      </div>
      {bad && <small className="hint">هر پیام باید خالی نباشد و حداکثر ۲۴ نویسه باشد.</small>}
    </div>
  );
}

function PlayersTab({ cfg, run }: { cfg: GameConfig; run: Run }) {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [d, setD] = useState<Detail | null>(null);
  const [amount, setAmount] = useState('');
  const [cur, setCur] = useState<'coins' | 'gems'>('coins');
  const [g, setG] = useState({ xp: 0, cardId: '' });
  const load = () => run(async () => { setUsers((await call(`/api/admin/users?q=${encodeURIComponent(q)}`)).users); });
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);
  const open = (id: number) => run(async () => { const j = await call(`/api/admin/user?id=${id}`); setD(j.user); setAmount(''); setG({ xp: 0, cardId: '' }); });
  const change = (sign: 1 | -1) => d && run(async () => {
    const j = await call('/api/admin/balance', { userId: d.id, currency: cur, delta: sign * amt });
    setD(j.user); setAmount(''); await load();
  }, `${fa(amt)} ${cur === 'coins' ? 'سکه' : 'الماس'} ${sign > 0 ? 'اضافه' : 'کم'} شد`);
  const amt = Math.floor(Number(amount));
  const cardName = (id: string) => cfg.cards.find((c) => c.id === id)?.name ?? id;
  const when = (t: number) => new Date(t).toLocaleDateString('fa-IR');

  return (
    <div className="box">
      <form className="searchrow" onSubmit={(e) => { e.preventDefault(); void load(); }}>
        <label className="field" style={{ flex: 1 }}>جستجو (نام یا شناسه‌ی تلگرام)<input value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <button className="btn">جستجو</button>
      </form>
      <small className="hint" style={{ textAlign: 'start' }}>روی هر بازیکن بزن تا اطلاعات کامل و مدیریت سکه و الماسش باز شود.</small>
      <div className="tblwrap"><table className="clickable">
        <thead><tr><th>بازیکن</th><th>شناسه</th><th>لول</th><th>برد / باخت</th><th>سکه</th><th>الماس</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} tabIndex={0} onClick={() => void open(u.id)} onKeyDown={(e) => { if (e.key === 'Enter') void open(u.id); }}>
              <td><span className="who"><Av url={u.avatar} name={u.name} /> <span>{u.name}</span>{u.banned ? <span className="tag bad">مسدود</span> : null}</span></td>
              <td className="num">{u.tg_id}</td><td>{fa(u.level)}</td>
              <td>{fa(u.wins)} / {fa(u.losses)}</td><td>{fa(u.coins)}</td><td>{fa(u.gems ?? 0)}</td>
            </tr>
          ))}
          {users.length === 0 && <tr><td colSpan={6}>بازیکنی پیدا نشد</td></tr>}
        </tbody>
      </table></div>

      {d && (
        <Modal onClose={() => setD(null)}>
          <div className="pdetail">
            <div className="phead">
              <Av url={d.avatar} name={d.name} big />
              <div>
                <h3>{d.name} {d.banned ? <span className="tag bad">مسدود</span> : null}</h3>
                <small className="num" dir="ltr">ID: {d.tgId}</small><br />
                <small>عضویت: {when(d.createdAt)}</small>
              </div>
            </div>

            <div className="pstats">
              <div><small>لول</small><b>{fa(d.level)}</b></div>
              <div><small>XP</small><b className="num" dir="ltr">{fa(d.xp)} / {fa(d.xpNeeded)}</b></div>
              <div><small>برد</small><b>{fa(d.wins)}</b></div>
              <div><small>باخت</small><b>{fa(d.losses)}</b></div>
              <div><small>درصد برد</small><b>{d.wins + d.losses ? `${fa(Math.round((d.wins / (d.wins + d.losses)) * 100))}٪` : '—'}</b></div>
              <div><small>کارت‌ها</small><b>{fa(d.cards.length)} از {fa(cfg.cards.length)}</b></div>
            </div>
            <small>سولو: {soloText(cfg, d.soloStage)}</small>

            <div className="coinbox">
              <div className="coinnow">سکه‌ی فعلی <b className="num">{fa(d.coins)}</b></div>
              <div className="coinnow">الماس سرخ فعلی <b className="num" style={{ color: '#ff8a98' }}>{fa(d.gems ?? 0)}</b></div>
              <div className="tabs" role="tablist" aria-label="نوع دارایی">
                <button role="tab" aria-selected={cur === 'coins'} onClick={() => setCur('coins')}><Icon n="coin" /> سکه</button>
                <button role="tab" aria-selected={cur === 'gems'} onClick={() => setCur('gems')}>💎 الماس</button>
              </div>
              <div className="searchrow">
                <label className="field" style={{ flex: 1 }}>مقدار دلخواه
                  <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="مثلاً ۲۵۰" />
                </label>
                <button className="btn ghost pos" disabled={!(amt > 0)} onClick={() => void change(1)}>+ اضافه</button>
                <button className="btn ghost neg" disabled={!(amt > 0)} onClick={() => void change(-1)}>− کم کن</button>
              </div>
            </div>

            <div>
              <b>کارت‌ها</b>
              <div className="chips">
                {d.cards.map((c) => (
                  <span key={c.id} className={`chip ${d.deck.includes(c.id) ? 'indeck' : ''}`}>{cardName(c.id)} <em>لول {fa(c.level)}</em> <em>× {fa(c.copies)}</em></span>
                ))}
              </div>
              <small>کارت‌های رنگی داخل ترکیبِ بازیکن‌اند. «×» تعداد کارتِ ذخیره‌شده برای ارتقاست.</small>
            </div>

            <div className="giftbox">
              <b>هدیه</b>
              <div className="fgrid">
                <label className="field">XP<input type="number" min={0} value={g.xp} onChange={(e) => setG({ ...g, xp: Number(e.target.value) })} /></label>
                <label className="field">یک کارت
                  <select value={g.cardId} onChange={(e) => setG({ ...g, cardId: e.target.value })}>
                    <option value="">— هیچ —</option>{cfg.cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              </div>
              <button className="btn ghost" disabled={!(g.xp > 0) && !g.cardId} onClick={() => run(async () => { await call('/api/admin/gift', { userId: d.id, xp: g.xp, cardId: g.cardId }); const j = await call(`/api/admin/user?id=${d.id}`); setD(j.user); setG({ xp: 0, cardId: '' }); await load(); }, 'هدیه داده شد')}>ارسال هدیه</button>
            </div>

            <div className="btns">
              <button className="btn ghost danger" onClick={() => run(async () => { await call('/api/admin/ban', { userId: d.id, banned: !d.banned }); setD({ ...d, banned: !d.banned }); await load(); }, d.banned ? 'رفع مسدودی شد' : 'مسدود شد')}>{d.banned ? 'رفع مسدودی' : 'مسدود کردن'}</button>
              <button className="btn" onClick={() => setD(null)}>بستن</button>
            </div>
          </div>
        </Modal>
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
