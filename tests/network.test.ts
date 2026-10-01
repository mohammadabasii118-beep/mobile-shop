import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { Bot } from 'grammy';
import { loadEnv, resetEnvCache } from '../src/config/env';
import { telegramApiRoot, telegramClientOptions, telegramGet } from '../src/bot/telegramNet';
import { XuiClient } from '../src/providers/vpn/xui/client';
import { xuiFetch } from '../src/providers/vpn/xui/net';

const closers: (() => void)[] = [];
afterEach(() => { closers.splice(0).forEach((c) => c()); for (const k of ['TELEGRAM_API_ROOT', 'TELEGRAM_PROXY_URL', 'XUI_TLS_INSECURE']) delete process.env[k]; resetEnvCache(); });
const listen = (s: net.Server) => new Promise<number>((r) => s.listen(0, '127.0.0.1', () => { closers.push(() => s.close()); r((s.address() as AddressInfo).port); }));

const fakeBotApi = () => http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ ok: true, result: req.url!.endsWith('/getMe') ? { id: 1, is_bot: true, first_name: 'X', username: 'relay_bot' } : true }));
});

describe('Telegram network routing (servers where api.telegram.org is blocked)', () => {
  it('TELEGRAM_API_ROOT sends all Bot API calls to the relay', async () => {
    const seen: string[] = [];
    const srv = fakeBotApi(); srv.on('request', (r) => seen.push(r.url!));
    const port = await listen(srv);
    process.env.TELEGRAM_API_ROOT = `http://127.0.0.1:${port}/`; resetEnvCache();
    expect(telegramApiRoot()).toBe(`http://127.0.0.1:${port}`);
    const bot = new Bot('123:TOKEN', { client: telegramClientOptions() });
    expect((await bot.api.getMe()).username).toBe('relay_bot');
    expect(seen).toEqual(['/bot123:TOKEN/getMe']);
  });
  it('TELEGRAM_PROXY_URL tunnels Bot API calls and file downloads through the proxy', async () => {
    const target = fakeBotApi(); const tport = await listen(target);
    const tunnels: string[] = [];
    const proxy = http.createServer();
    proxy.on('connect', (req, client, head) => {
      tunnels.push(req.url!);
      const [h, p] = req.url!.split(':');
      const up = net.connect(Number(p), h, () => { client.write('HTTP/1.1 200 Connection Established\r\n\r\n'); up.write(head); up.pipe(client); client.pipe(up); });
      up.on('error', () => client.destroy()); client.on('error', () => up.destroy());
    });
    const pport = await listen(proxy);
    process.env.TELEGRAM_API_ROOT = `http://127.0.0.1:${tport}`; process.env.TELEGRAM_PROXY_URL = `http://127.0.0.1:${pport}`; resetEnvCache();
    const bot = new Bot('123:TOKEN', { client: telegramClientOptions() });
    expect((await bot.api.getMe()).username).toBe('relay_bot');
    const dl = await telegramGet(`${telegramApiRoot()}/file/bot123:TOKEN/photos/a.jpg`);
    expect(dl.status).toBe(200);
    expect(tunnels.length).toBeGreaterThanOrEqual(2);
    expect(tunnels.every((t) => t === `127.0.0.1:${tport}`)).toBe(true);
  });
  it('default is a direct connection to api.telegram.org', () => {
    resetEnvCache();
    expect(telegramApiRoot()).toBe('https://api.telegram.org');
    expect(telegramClientOptions()).toEqual({ apiRoot: 'https://api.telegram.org' });
  });
  it('new env vars parse (empty = unset)', () => {
    const e = loadEnv({ DATABASE_URL: 'x', TELEGRAM_PROXY_URL: '', XUI_TLS_INSECURE: 'true' } as any);
    expect(e.TELEGRAM_PROXY_URL).toBeUndefined(); expect(e.XUI_TLS_INSECURE).toBe(true);
  });
});

describe('X-UI over HTTPS / wrong scheme diagnostics', () => {
  function tlsPanel() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cert-'));
    execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${dir}/k.pem -out ${dir}/c.pem -days 1 -subj "/CN=localhost" 2>/dev/null`);
    const srv = https.createServer({ key: fs.readFileSync(`${dir}/k.pem`), cert: fs.readFileSync(`${dir}/c.pem`) }, (req, res) => {
      res.setHeader('content-type', 'application/json');
      if (req.url === '/login') { res.setHeader('set-cookie', '3x-ui=ok; Path=/'); return void res.end('{"success":true,"msg":"","obj":null}'); }
      res.end('{"success":true,"msg":"","obj":[{"id":1,"enable":true,"protocol":"vless","port":443,"settings":"{}"}]}');
    });
    return srv;
  }
  it('self-signed panel: rejected by default with a clear hint; accepted only with XUI_TLS_INSECURE', async () => {
    const port = await listen(tlsPanel());
    const strict = new XuiClient({ baseUrl: `https://127.0.0.1:${port}`, username: 'a', password: 'b', timeoutMs: 3000 });
    await expect(strict.listInbounds()).rejects.toThrow(/certificate is not trusted.*XUI_TLS_INSECURE/);
    process.env.XUI_TLS_INSECURE = 'true'; resetEnvCache();
    const lax = new XuiClient({ baseUrl: `https://127.0.0.1:${port}`, username: 'a', password: 'b', timeoutMs: 3000, fetchImpl: xuiFetch() });
    expect((await lax.listInbounds()).length).toBe(1);
  });
  it('xuiFetch is undefined unless explicitly enabled', () => { resetEnvCache(); expect(xuiFetch()).toBeUndefined(); });
  it('http:// to a TLS port (HPE_* parse error) tells the user to switch to https://', async () => {
    const port = await listen(net.createServer((c) => { c.once('data', () => c.end(Buffer.from([0x15, 0x03, 0x01, 0x00, 0x02, 0x02, 0x0a]))); }));
    const c = new XuiClient({ baseUrl: `http://127.0.0.1:${port}`, username: 'a', password: 'b', timeoutMs: 3000 });
    await expect(c.listInbounds()).rejects.toThrow(/probably HTTPS.*https:\/\//);
  });
});
