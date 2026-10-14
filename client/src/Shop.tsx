import { useCallback, useEffect, useState } from 'react';
import { resolveCard } from '@game/shared';
import type { Ctx } from './App';
import { call } from './net';
import { openInvoice, openLink } from './telegram';
import { CardTile, Gem, Icon, Modal, fa, fmtTime } from './ui';

interface ShopState { bought: number[]; resetInMs: number; orders: { id: number; gems: number; coins: number; toman: number; stars: number; method: string; status: string; createdAt: number }[] }
const STATUS_FA: Record<string, string> = { pending: 'در انتظار تأیید', delivered: 'تحویل شد', canceled: 'لغو شد' };
const cardFmt = (n: string) => n.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').trim();

export function Shop({ ctx }: { ctx: Ctx }) {
  const { cfg, profile: p, setProfile, toast } = ctx;
  const [st, setSt] = useState<ShopState | null>(null);
  const [at, setAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<{ packId: string; gems: number; coins: number; toman: number; note: string; sent: boolean } | null>(null);

  const load = useCallback(async () => {
    try { const j = await call('/api/shop/state'); setSt(j.shop); setAt(Date.now()); } catch (e) { toast((e as Error).message); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const act = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };

  const buyCard = (slot: number) => act(async () => {
    const j = await call('/api/shop/buy-card', { slot });
    setProfile(j.profile);
    toast(`${cfg.cards.find((c) => c.id === j.bought.cardId)?.name ?? 'کارت'} × ${fa(j.bought.count)} خریداری شد ✨`);
    await load();
  });
  const buyCoins = (id: string) => act(async () => {
    const j = await call('/api/shop/buy-coins', { id });
    setProfile(j.profile);
    toast(`${fa(j.got.coins)} سکه گرفتی`);
  });
  /** کارت‌به‌کارت: فقط پنجره‌ی راهنما باز می‌شود؛ هیچ سفارشی ثبت نمی‌شود تا وقتی بازیکن «پرداخت کردم» را بزند */
  const payCard = (id: string) => {
    const gp = cfg.shop.gemPacks.find((x) => x.id === id), cp = cfg.shop.coinPacks.find((x) => x.id === id);
    if (gp) setOrder({ packId: id, gems: gp.gems, coins: 0, toman: gp.toman, note: '', sent: false });
    else if (cp) setOrder({ packId: id, gems: 0, coins: cp.coins, toman: cp.price, note: '', sent: false });
  };
  const sendNote = () => act(async () => {
    if (!order) return;
    await call('/api/shop/order', { id: order.packId, note: order.note });
    setOrder({ ...order, sent: true });
    toast('ثبت شد؛ بعد از بررسی اضافه می‌شود');
    await load();
  });
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast('کپی شد'); } catch { toast('کپی نشد؛ شماره را دستی بنویس'); } };
  /** استار تلگرام: فاکتور باز می‌شود و بعد از پرداخت الماس خودکار اضافه می‌شود (چند ثانیه صبر می‌کنیم) */
  const payStars = (id: string) => act(async () => {
    const j = await call('/api/shop/stars', { id });
    const status = await openInvoice(j.url);
    if (status === 'cancelled' || status === 'failed') { toast(status === 'failed' ? 'پرداخت انجام نشد' : 'پرداخت لغو شد'); await load(); return; }
    toast('در حال تأیید پرداخت…');
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const me = await call('/api/me');
      if (me.profile.gems > p.gems) { setProfile(me.profile); toast(`${fa(j.order.gems)} الماس به حسابت اضافه شد 💎`); await load(); return; }
    }
    toast('پرداخت ثبت شد؛ اگر الماس نیامد چند دقیقه‌ی دیگر دوباره سر بزن');
    await load();
  });

  const left = st ? Math.max(0, st.resetInMs - (now - at)) : 0;
  const offers = cfg.shop.cards.map((o, slot) => ({ o, slot })).filter(({ o }) => !!o.cardId);

  return (
    <div className="shop">
      <section className="shopsec">
        <header className="shophd">
          <h2>پیشنهاد روزانه</h2>
          {st && <span className="reset">تا تغییر: <b className="num">{fmtTime(left)}</b></span>}
        </header>
        <div className="offers">
          {offers.map(({ o, slot }) => {
            const def = cfg.cards.find((c) => c.id === o.cardId);
            if (!def) return null;
            const s = resolveCard(def, 1, cfg);
            const done = !!st?.bought.includes(slot);
            return (
              <div key={slot} className={`offer ${done ? 'done' : ''}`}>
                <div className="ocard">
                  <CardTile def={def} level={1} maxLevel={cfg.upgrade.maxLevel} hp={s.hp} atk={s.atk} shield={s.shield} />
                  <b className="qty num">×{fa(o.count)}</b>
                </div>
                {done ? <div className="sold">✓ خریداری شد</div> : (
                  <div className="prices">
                    <button className={`pbtn ${o.currency === 'gems' ? 'gem' : 'coin'}`} disabled={busy || (o.currency === 'gems' ? p.gems : p.coins) < o.price} onClick={() => void buyCard(slot)} aria-label={`خرید با ${fa(o.price)} ${o.currency === 'gems' ? 'الماس' : 'سکه'}`}>
                      {o.currency === 'gems' ? <Gem /> : <Icon n="coin" />} <b className="num">{fa(o.price)}</b>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {offers.length === 0 && <p className="shopempty">امروز پیشنهادی نیست.</p>}
        </div>
      </section>

      <section className="shopsec">
        <header className="shophd"><h2>باکس سکه</h2></header>
        <div className="packs">
          {cfg.shop.coinPacks.filter((k) => k.currency === 'gems' || cfg.shop.card.enabled).map((k) => (
            <div key={k.id} className="pack coinp">
              <div className="pico"><Icon n="coin" /></div>
              <b className="num">{fa(k.coins)}</b><small>سکه</small>
              {k.currency === 'gems'
                ? <button className="pbtn gem" disabled={busy || p.gems < k.price} onClick={() => void buyCoins(k.id)}><Gem /> <b className="num">{fa(k.price)}</b></button>
                : <button className="pbtn toman" disabled={busy} onClick={() => payCard(k.id)} aria-label={`خرید کارت‌به‌کارت ${fa(k.price)} تومان`}><b className="num">{fa(k.price)}</b> <small>تومان</small></button>}
            </div>
          ))}
          {cfg.shop.coinPacks.filter((k) => k.currency === 'gems' || cfg.shop.card.enabled).length === 0 && <p className="shopempty">فعلاً بسته‌ای نیست.</p>}
        </div>
      </section>

      <section className="shopsec">
        <header className="shophd"><h2>خرید الماس</h2><small>کارت‌به‌کارت یا استار تلگرام</small></header>
        <div className="packs">
          {cfg.shop.gemPacks.map((k) => (
            <div key={k.id} className="pack gemp">
              <div className="pico"><Gem className="gemi big" /></div>
              <b className="num">{fa(k.gems)}</b><small>الماس</small>
              <div className="pays">
                {cfg.shop.card.enabled && k.toman > 0 && <button className="pbtn toman" disabled={busy} onClick={() => payCard(k.id)} aria-label={`خرید کارت‌به‌کارت ${fa(k.toman)} تومان`}><b className="num">{fa(k.toman)}</b> <small>تومان</small></button>}
                {cfg.shop.starsEnabled && k.stars > 0 && <button className="pbtn stars" disabled={busy} onClick={() => void payStars(k.id)} aria-label={`خرید با ${fa(k.stars)} استار`}>⭐ <b className="num">{fa(k.stars)}</b> <small>استار</small></button>}
              </div>
            </div>
          ))}
          {cfg.shop.gemPacks.length === 0 && <p className="shopempty">فعلاً بسته‌ای نیست.</p>}
        </div>
        {st && st.orders.length > 0 && (
          <div className="myorders">
            <small>سفارش‌های اخیر تو</small>
            {st.orders.map((o) => (
              <div key={o.id} className={`ord ${o.status}`}><span>#{fa(o.id)} · <b className="num">{o.coins > 0 ? `${fa(o.coins)} سکه` : `${fa(o.gems)} الماس`}</b> · {o.method === 'stars' ? `${fa(o.stars)} استار` : `${fa(o.toman)} تومان`}</span><em>{STATUS_FA[o.status] ?? o.status}</em></div>
            ))}
          </div>
        )}
      </section>

      {order && (
        <Modal onClose={() => setOrder(null)}>
          <div className="center-in cardpay">
            <h3>پرداخت کارت‌به‌کارت</h3>
            <p>{order.coins > 0 ? <span className="coinv"><Icon n="coin" /> {fa(order.coins)} سکه</span> : <><Gem /> {fa(order.gems)} الماس</>} — مبلغ: <b className="num">{fa(order.toman)}</b> تومان</p>
            <div className="cardbox">
              <small>شماره‌ی کارت (روی آن بزن تا کپی شود)</small>
              <button className="cnum num" dir="ltr" onClick={() => void copy(cfg.shop.card.number.replace(/\D/g, ''))}>{cardFmt(cfg.shop.card.number)}</button>
              <span>به نام <b>{cfg.shop.card.holder || '—'}</b>{cfg.shop.card.bank ? ` · ${cfg.shop.card.bank}` : ''}</span>
            </div>
            <p className="hint">دقیقاً مبلغ بالا را واریز کن. بعد کد پیگیری (یا ۴ رقم آخر کارتِ خودت) را بنویس و «پرداخت کردم» را بزن. ادمین بررسی می‌کند و به حسابت اضافه می‌شود. تا «پرداخت کردم» را نزنی هیچ سفارشی ثبت نمی‌شود. شناسه‌ی تو: <b className="num">{fa(p.id)}</b></p>
            {order.sent ? <p className="sent">✓ ثبت شد، منتظر بررسی ادمین باش.</p> : (
              <>
                <input className="notein" value={order.note} maxLength={60} onChange={(e) => setOrder({ ...order, note: e.target.value })} placeholder="کد پیگیری یا ۴ رقم آخر کارت" />
                <button className="btn" disabled={busy || !order.note.trim()} onClick={() => void sendNote()}>پرداخت کردم</button>
              </>
            )}
            <button className="btn ghost" onClick={() => setOrder(null)}>بستن</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
