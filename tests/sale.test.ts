import { beforeEach, describe, expect, it } from 'vitest';
import { makeProduct, makeUser, resetDb, setup } from './helpers';
import { setSetting } from '../src/modules/settings/service';
import { getSale, parseTehranTime, saleAmount } from '../src/modules/sale/service';
import { quote } from '../src/modules/orders/pricing';
import { createOrder } from '../src/modules/orders/service';

setup();
beforeEach(resetDb);

const inHours = (h: number) => {
  const d = new Date(Date.now() + h * 3_600_000 + 3.5 * 3_600_000); // shift to Tehran wall-clock
  return d.toISOString().slice(0, 16).replace('T', ' ');
};

describe('store-wide sale', () => {
  it('parses Tehran time and rejects garbage', () => {
    expect(parseTehranTime('2026-10-30 23:59')!.toISOString()).toBe('2026-10-30T20:29:00.000Z');
    expect(parseTehranTime('soon')).toBeNull();
  });

  it('is off by default, on with a percentage, off after the end time', async () => {
    expect((await getSale()).active).toBe(false);
    await setSetting('sale.percent', '20');
    expect(await getSale()).toMatchObject({ active: true, percent: 20, endsAt: null });
    await setSetting('sale.endsAt', inHours(5));
    expect((await getSale()).active).toBe(true);
    await setSetting('sale.endsAt', inHours(-1));
    expect((await getSale()).active).toBe(false);
    await setSetting('sale.endsAt', 'garbage');
    expect((await getSale()).active).toBe(false); // unreadable end date never runs a sale forever
    expect(saleAmount(await getSale(), 100_000)).toBe(0);
  });

  it('quote() applies the sale, a coupon applies on the reduced price, and the order stores it', async () => {
    const u = await makeUser(); const p = await makeProduct({ price: 250_000 });
    await setSetting('sale.percent', '20'); await setSetting('sale.endsAt', inHours(5));
    const q = await quote(u.id, p.price, undefined);
    expect(q).toMatchObject({ salePercent: 20, saleDiscount: 50_000, discount: 50_000, final: 200_000 });
    const { order } = await createOrder({ userId: u.id, productId: p.id, paymentMethod: 'CARD_TO_CARD' } as any);
    expect(order).toMatchObject({ amount: 250_000, discountAmount: 50_000, finalAmount: 200_000, partnerDiscountAmount: 0 });
    // sale ends -> an open unpaid order is NOT reused at the old price
    await setSetting('sale.percent', '0');
    const again = await createOrder({ userId: u.id, productId: p.id, paymentMethod: 'CARD_TO_CARD' } as any);
    expect(again.reused).toBe(false);
    expect(again.order.finalAmount).toBe(250_000);
  });
});
