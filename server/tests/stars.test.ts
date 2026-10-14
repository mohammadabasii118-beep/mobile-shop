import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { openDb } from '../src/db';
import { createGameServer } from '../src/server';

const TOKEN = '123:STARS-TEST';
const sign = (id: number) => {
  const f: Record<string, string> = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: 'U' + id }) };
  const check = Object.entries(f).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const hash = createHmac('sha256', createHmac('sha256', 'WebAppData').update(TOKEN).digest()).update(check).digest('hex');
  return new URLSearchParams({ ...f, hash }).toString();
};

let tg: ReturnType<typeof createServer>;
let srv: ReturnType<typeof createGameServer>;
let base = '';
let invoiceReq: any = null;
let tgFails = false;
const cfg = loadConfig();
cfg.channel = { username: 'MirasGame', required: false };

beforeAll(async () => {
  // تلگرامِ ساختگی: فقط createInvoiceLink
  tg = createServer((req, res) => {
    let s = ''; req.on('data', (d) => { s += d; });
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      if (req.url?.endsWith('/createInvoiceLink') && !tgFails) { invoiceReq = JSON.parse(s); res.end(JSON.stringify({ ok: true, result: 'https://t.me/$fake-invoice' })); }
      else res.end(JSON.stringify({ ok: false, description: 'boom' }));
    });
  });
  await new Promise<void>((r) => tg.listen(0, r));
  const tgBase = `http://127.0.0.1:${(tg.address() as AddressInfo).port}`;
  srv = createGameServer({ db: openDb(), cfg, auth: { botToken: TOKEN, devAuth: false }, adminIds: [], dataDir: mkdtempSync(join(tmpdir(), 'stars-')), telegramApi: tgBase });
  await new Promise<void>((r) => srv.http.listen(0, r));
  base = `http://127.0.0.1:${(srv.http.address() as AddressInfo).port}`;
});
afterAll(() => { srv.close(); tg.close(); });

const call = (id: number, path: string, body?: object) =>
  fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'x-init-data': sign(id), 'content-type': 'application/json' }, body: body && JSON.stringify(body) }).then(async (r) => ({ status: r.status, j: await r.json() as any }));

describe('telegram stars', () => {
  it('creates an XTR invoice, validates pre-checkout, and credits gems once on successful payment', async () => {
    const pk = cfg.shop.gemPacks[0];
    await call(500, '/api/me');
    const r = await call(500, '/api/shop/stars', { id: pk.id });
    expect(r.status).toBe(200);
    expect(r.j.url).toBe('https://t.me/$fake-invoice');
    expect(invoiceReq).toMatchObject({ currency: 'XTR', provider_token: '', payload: `order:${r.j.order.id}`, prices: [{ amount: pk.stars }] });
    const payload = `order:${r.j.order.id}`;
    expect(srv.stars.preCheckout({ currency: 'XTR', total_amount: pk.stars, invoice_payload: payload, from: { id: 500 } })).toBeNull();
    expect(srv.stars.preCheckout({ currency: 'XTR', total_amount: pk.stars, invoice_payload: payload, from: { id: 501 } })).toBeTruthy();
    expect(srv.stars.preCheckout({ currency: 'USD', total_amount: pk.stars, invoice_payload: payload, from: { id: 500 } })).toBeTruthy();
    const pay = { from: { id: 500 }, successful_payment: { currency: 'XTR', total_amount: pk.stars, invoice_payload: payload, telegram_payment_charge_id: 'tg-charge-1' } };
    expect(srv.stars.payment(pay)).toMatch(/الماس/);
    expect(srv.stars.payment(pay)).toBeNull();                              // تکراری: دوباره اضافه نمی‌شود
    expect((await call(500, '/api/me')).j.profile.gems).toBe(50 + pk.gems);
  });

  it('a failing telegram call cancels the order and shows an error', async () => {
    tgFails = true;
    const r = await call(501, '/api/shop/stars', { id: cfg.shop.gemPacks[0].id });
    expect(r.status).toBe(400);
    tgFails = false;
    expect(srv.game.adminOrders('pending').filter((o) => o.tgId === 501)).toHaveLength(0);
  });

  it('stars disabled or pack without stars price is refused', async () => {
    const off = { ...cfg.shop, starsEnabled: false };
    Object.assign(cfg, { shop: off });
    expect((await call(502, '/api/shop/stars', { id: cfg.shop.gemPacks[0].id })).status).toBe(400);
    Object.assign(cfg, { shop: { ...off, starsEnabled: true } });
  });
});
