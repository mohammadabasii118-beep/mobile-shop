import { useCallback, useEffect, useState } from 'react';
import { resolveCard } from '@game/shared';
import type { Ctx } from './App';
import { call } from './net';
import { openInvoice, openLink } from './telegram';
import { CardTile, Gem, Icon, Modal, fa, fmtTime } from './ui';

interface ShopState { bought: number[]; resetInMs: number; orders: { id: number; gems: number; toman: number; stars: number; method: string; status: string; createdAt: number }[] }
const STATUS_FA: Record<string, string> = { pending: 'در انتظار تأیید', delivered: 'تحویل شد', canceled: 'لغو شد' };
const cardFmt = (n: string) => n.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').trim();

export function Shop({ ctx }: { ctx: Ctx }) {
  const { cfg, profile: p, setProfile, toast } = ctx;
  const [st, setSt] = useState<ShopState | null>(null);
  const [at, setAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<{ id: number; gems: number; toman: number; note: string; sent: boolean } | null>(null);

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

  const buyCard = (slot: number, currency: 'coins' | 'gems') => act(async () => {
    const j = await call('/api/shop/buy-card', { slot, currency });
    setProfile(j.profile);
    toast(`${cfg.cards.find((c) => c.id === j.bought.cardId)?.name ?? 'کارت'} × ${fa(j.bought.count)} خریداری شد ✨`);
    await load();
  });
  const buyCoins = (id: string) => act(async () => {
    const j = await call('/api/shop/buy-coins', { id });
    setProfile(j.profile);
    toast(`${fa(j.got.coins)} سکه گرفتی`);
  });
  /** کارت‌به‌کارت: سفارش ثبت می‌شود و مشخصات کارت نشان داده می‌شود */
  const payCard = (id: string) => act(async () => {
    const j = await call('/api/shop/order', { id });
    setOrder({ ...j.order, note: '', sent: false });
    await load();
  });
  const sendNote = () => act(async () => {
    if (!order) return;
    await call('/api/shop/order-note', { id: order.id, note: order.note });
    setOrder({ ...order, sent: true });
    toast('ثبت شد؛ بعد از بررسی، الماس اضافه می‌شود');
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
                    {o.priceGems > 0 && (
                      <button className="pbtn gem" disabled={busy || p.gems < o.priceGems} onClick={() => void buyCard(slot, 'gems')} aria-label={`خرید با ${fa(o.priceGems)} الماس`}>
                        <Gem /> <b className="num">{fa(o.priceGems)}</b>
                      </button>
                    )}
                    {o.priceCoins > 0 && (
                      <button className="pbtn coin" disabled={busy || p.coins < o.priceCoins} onClick={() => void buyCard(slot, 'coins')} aria-label={`خرید با ${fa(o.priceCoins)} سکه`}>
                        <Icon n="coin" /> <b className="num">{fa(o.priceCoins)}</b>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {offers.length === 0 && <p className="empty">امروز پیشنهادی نیست.</p>}
        </div>
      </section>

      <section className="shopsec">
        <header className="shophd"><h2>باکس سکه</h2><small>با الماس</small></header>
        <div className="packs">
          {cfg.shop.coinPacks.map((k) => (
            <div key={k.id} className="pack coinp">
              <div className="pico"><Icon n="coin" /></div>
              <b className="num">{fa(k.coins)}</b><small>سکه</small>
              <button className="pbtn gem" disabled={busy || p.gems < k.gems} onClick={() => void buyCoins(k.id)}><Gem /> <b className="num">{fa(k.gems)}</b></button>
            </div>
          ))}
          {cfg.shop.coinPacks.length === 0 && <p className="empty">فعلاً بسته‌ای نیست.</p>}
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
                {cfg.shop.card.enabled && k.toman > 0 && <button className="pbtn toman" disabled={busy} onClick={() => void payCard(k.id)} aria-label={`خرید کارت‌به‌کارت ${fa(k.toman)} تومان`}><b className="num">{fa(k.toman)}</b> <small>تومان</small></button>}
                {cfg.shop.starsEnabled && k.stars > 0 && <button className="pbtn stars" disabled={busy} onClick={() => void payStars(k.id)} aria-label={`خرید با ${fa(k.stars)} استار`}>⭐ <b className="num">{fa(k.stars)}</b> <small>استار</small></button>}
              </div>
            </div>
          ))}
          {cfg.shop.gemPacks.length === 0 && <p className="empty">فعلاً بسته‌ای نیست.</p>}
        </div>
        {st && st.orders.length > 0 && (
          <div className="myorders">
            <small>سفارش‌های اخیر تو</small>
            {st.orders.map((o) => (
              <div key={o.id} className={`ord ${o.status}`}><span>#{fa(o.id)} · <b className="num">{fa(o.gems)}</b> الماس · {o.method === 'stars' ? `${fa(o.stars)} استار` : `${fa(o.toman)} تومان`}</span><em>{STATUS_FA[o.status] ?? o.status}</em></div>
            ))}
          </div>
        )}
      </section>

      {order && (
        <Modal onClose={() => setOrder(null)}>
          <div className="center-in cardpay">
            <h3>پرداخت کارت‌به‌کارت</h3>
            <p><Gem /> {fa(order.gems)} الماس — مبلغ: <b className="num">{fa(order.toman)}</b> تومان</p>
            <div className="cardbox">
              <small>شماره‌ی کارت (روی آن بزن تا کپی شود)</small>
              <button className="cnum num" dir="ltr" onClick={() => void copy(cfg.shop.card.number.replace(/\D/g, ''))}>{cardFmt(cfg.shop.card.number)}</button>
              <span>به نام <b>{cfg.shop.card.holder || '—'}</b>{cfg.shop.card.bank ? ` · ${cfg.shop.card.bank}` : ''}</span>
            </div>
            <p className="hint">دقیقاً مبلغ بالا را واریز کن. بعد کد پیگیری (یا ۴ رقم آخر کارتِ خودت) را بنویس و «پرداخت کردم» را بزن. ادمین بررسی می‌کند و الماس به حسابت اضافه می‌شود. کد سفارش: <b className="num">#{fa(order.id)}</b> · شناسه‌ی تو: <b className="num">{fa(p.id)}</b></p>
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
