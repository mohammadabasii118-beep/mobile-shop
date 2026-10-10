import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { startBot } from '../src/bot';

/** تلگرامِ جعلی: یک /start می‌دهد و پیام‌های ارسالی را ثبت می‌کند */
function fakeTelegram(mode: 'ok' | 'conflict') {
  const calls: { method: string; body: any }[] = [];
  let delivered = false;
  const srv = createServer((req, res) => {
    let s = ''; req.on('data', (d) => (s += d));
    req.on('end', () => {
      const method = req.url!.split('/').pop()!; const body = s ? JSON.parse(s) : {};
      calls.push({ method, body });
      const out = (o: object) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
      if (method === 'getMe') return out({ ok: true, result: { username: 'mirasbot' } });
      if (method === 'getUpdates') {
        if (mode === 'conflict') return out({ ok: false, error_code: 409, description: 'Conflict' });
        if (!delivered) { delivered = true; return out({ ok: true, result: [{ update_id: 7, message: { chat: { id: 55, type: 'private' }, text: '/start' } }] }); }
        return setTimeout(() => out({ ok: true, result: [] }), 100);
      }
      out({ ok: true, result: {} });
    });
  });
  return { srv, calls };
}
const listen = (srv: ReturnType<typeof createServer>) => new Promise<string>((r) => srv.listen(0, () => r(`http://127.0.0.1:${(srv.address() as AddressInfo).port}`)));
const until = async (f: () => boolean) => { for (let i = 0; i < 50 && !f(); i++) await new Promise((r) => setTimeout(r, 40)); };

describe('bot', () => {
  it('answers /start with a web_app button and sets the menu button', async () => {
    const { srv, calls } = fakeTelegram('ok'); const apiBase = await listen(srv);
    const bot = startBot({ token: 'T', webAppUrl: 'https://game.example.com', apiBase, log: () => {} });
    await until(() => calls.some((c) => c.method === 'sendMessage'));
    bot.stop(); srv.close();
    const msg = calls.find((c) => c.method === 'sendMessage')!;
    expect(msg.body.chat_id).toBe(55);
    expect(msg.body.reply_markup.inline_keyboard[0][0].web_app.url).toBe('https://game.example.com');
    expect(calls.find((c) => c.method === 'setChatMenuButton')!.body.menu_button.web_app.url).toBe('https://game.example.com');
  });

  it('stops polling on 409 so it never fights another bot using the token', async () => {
    const { srv, calls } = fakeTelegram('conflict'); const apiBase = await listen(srv);
    const logs: string[] = [];
    startBot({ token: 'T', webAppUrl: 'https://game.example.com', apiBase, log: (s) => logs.push(s) });
    await until(() => logs.some((l) => l.includes('۴۰۹')));
    await new Promise((r) => setTimeout(r, 300)); srv.close();
    expect(calls.filter((c) => c.method === 'getUpdates')).toHaveLength(1);
  });

  it('refuses non-https urls', () => {
    const logs: string[] = [];
    startBot({ token: 'T', webAppUrl: 'http://x', apiBase: 'http://127.0.0.1:1', log: (s) => logs.push(s) });
    expect(logs[0]).toMatch(/https/);
  });
});
