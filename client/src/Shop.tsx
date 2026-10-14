import { useCallback, useEffect, useState } from 'react';
import { resolveCard } from '@game/shared';
import type { Ctx } from './App';
import { call } from './net';
import { openLink } from './telegram';
import { CardTile, Gem, Icon, Modal, fa, fmtTime } from './ui';

interface ShopState { bought: number[]; resetInMs: number; orders: { id: number; gems: number; toman: number; status: string; createdAt: number }[] }
const STATUS_FA: Record<string, string> = { pending: 'در انتظار تأیید', delivered: 'تحویل شد', canceled: 'لغو شد' };

export function Shop({ ctx }: { ctx: Ctx }) {
  const { cfg, profile: p, setProfile, toast } = ctx;
  const [st, setSt] = useState<ShopState | null>(null);
  const [at, setAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<{ id: number; gems: number; toman: number; url: string | null } | null>(null);

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
  const buyGems = (id: string) => act(async () => {
    const j = await call('/api/shop/order', { id });
    setOrder({ ...j.order, url: j.url });
    if (j.url) openLink(j.url);
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
        <header className="shophd"><h2>خرید الماس</h2><small>با تومان</small></header>
        <div className="packs">
          {cfg.shop.gemPacks.map((k) => (
            <div key={k.id} className="pack gemp">
              <div className="pico"><Gem className="gemi big" /></div>
              <b className="num">{fa(k.gems)}</b><small>الماس</small>
              <button className="pbtn toman" disabled={busy} onClick={() => void buyGems(k.id)}><b className="num">{fa(k.toman)}</b> <small>تومان</small></button>
            </div>
          ))}
          {cfg.shop.gemPacks.length === 0 && <p className="empty">فعلاً بسته‌ای نیست.</p>}
        </div>
        {st && st.orders.length > 0 && (
          <div className="myorders">
            <small>سفارش‌های اخیر تو</small>
            {st.orders.map((o) => (
              <div key={o.id} className={`ord ${o.status}`}><span>#{fa(o.id)} · <b className="num">{fa(o.gems)}</b> الماس · {fa(o.toman)} تومان</span><em>{STATUS_FA[o.status] ?? o.status}</em></div>
            ))}
          </div>
        )}
      </section>

      {order && (
        <Modal onClose={() => setOrder(null)}>
          <div className="center-in">
            <h3>سفارش #{fa(order.id)} ثبت شد</h3>
            <p><Gem /> {fa(order.gems)} الماس — {fa(order.toman)} تومان</p>
            <p className="hint">صفحه‌ی پرداخت باز شد. بعد از پرداخت، ادمین سفارش را بررسی می‌کند و الماس به حسابت اضافه می‌شود. شناسه‌ی عددی تو: <b className="num">{fa(p.id)}</b></p>
            {order.url && <button className="btn ghost" onClick={() => openLink(order.url!)}>باز کردن دوباره‌ی صفحه‌ی پرداخت</button>}
            <button className="btn" onClick={() => setOrder(null)}>باشه</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
