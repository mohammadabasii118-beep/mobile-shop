/**
 * DEMO ENGINE — runs the REAL bot/business logic with:
 *   - a fake Telegram transport (messages are captured, no network)
 *   - a fake 3x-ui panel over real HTTP (dev/fakeXui.ts) driven by the REAL XuiVpnProvider
 * Never use in production (VPN provider is the dev fake).
 */
import { prisma } from '../src/db/client';
import { createBot } from '../src/bot';
import { FakeXui } from '../dev/fakeXui';
import { XuiClient } from '../src/providers/vpn/xui/client';
import { XuiVpnProvider } from '../src/providers/vpn/xui/provider';
import { setVpnProvider } from '../src/providers/vpn';
import { createProduct } from '../src/modules/products/service';
import { ingestBankTransaction } from '../src/modules/payments/service';
import { setSetting } from '../src/modules/settings/service';
import QRCode from 'qrcode';

export interface SimMessage { id: number; chat: number; text?: string; buttons?: { text: string; data?: string }[][]; image?: string; at: number }

const plain = (t: string) => t.replace(/<\/?(b|i|code)>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
export async function createEngine(opts: { editInPlace?: boolean } = {}) {
  const panel = await new FakeXui().start();
  setVpnProvider(new XuiVpnProvider({
    client: new XuiClient({ baseUrl: panel.url, username: 'admin', password: 'secret' }),
    publicHost: 'vpn.demo.example', subBaseUrl: 'https://sub.demo.example:2096/sub/',
  }));
  await setSetting('card.enabled', 'true');
  await setSetting('card.number', '6037991122334455');
  await setSetting('card.holder', 'DEMO HOLDER');
  await setSetting('card.bank', 'Demo Bank');
  if ((await prisma.product.count()) === 0) {
    await createProduct('demo', { name: '50GB / 30 روزه', description: 'پلن اقتصادی', durationDays: 30, trafficGB: 50, price: 250000, xuiInboundId: 1, protocol: 'VLESS', sortOrder: 1 });
    await createProduct('demo', { name: '100GB / 60 روزه', description: 'پلن ویژه', durationDays: 60, trafficGB: 100, price: 450000, xuiInboundId: 1, protocol: 'VLESS', sortOrder: 2 });
  }

  const log: SimMessage[] = [];
  let mid = 0, uid = 1;
  const bot = createBot('123:DEMO', {
    botInfo: { id: 123, is_bot: true, first_name: 'DemoBot', username: 'demo_bot', can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false } as any,
    fetchFile: async () => Buffer.from(`receipt-${Math.random()}`),
  });
  bot.api.config.use(async (_prev, method, payload: any) => {
    if (method.startsWith('send') || method.startsWith('edit')) {
      const id = ++mid;
      let image: string | undefined;
      const fd = payload.photo?.fileData;
      if (Buffer.isBuffer(fd)) image = `data:image/png;base64,${fd.toString('base64')}`;
      const buttons = payload.reply_markup?.inline_keyboard?.map((r: any[]) => r.map((b) => ({ text: b.text, data: b.callback_data })));
      if (method.startsWith('edit') && opts.editInPlace) {
        const last = [...log].reverse().find((m) => m.chat === Number(payload.chat_id) && m.buttons !== undefined);
        if (last && payload.text) { last.text = payload.parse_mode === 'HTML' ? plain(payload.text) : payload.text; last.buttons = buttons; return { ok: true, result: { message_id: last.id, date: 0, chat: { id: payload.chat_id, type: 'private' } } } as any; }
      }
      const txt = payload.text ?? payload.caption;
      log.push({ id, chat: Number(payload.chat_id), text: txt && payload.parse_mode === 'HTML' ? plain(txt) : txt, buttons, image, at: Date.now() });
      return { ok: true, result: { message_id: id, date: 0, chat: { id: payload.chat_id, type: 'private' }, text: payload.text } } as any;
    }
    return { ok: true, result: true } as any;
  });

  const from = (id: number, name: string) => ({ id, is_bot: false, first_name: name, username: `user${id}` });
  return {
    panel, log, bot,
    async text(chat: number, name: string, text: string) {
      const entities = text.startsWith('/') ? [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] : undefined;
      await bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, chat: { id: chat, type: 'private' }, from: from(chat, name), text, entities } } as any);
    },
    async tap(chat: number, name: string, data: string) {
      await bot.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from: from(chat, name), chat_instance: 'x', data, message: { message_id: 1, date: 0, chat: { id: chat, type: 'private' }, text: 'x' } } } as any);
    },
    async photo(chat: number, name: string, caption?: string) {
      await bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, chat: { id: chat, type: 'private' }, from: from(chat, name), photo: [{ file_id: `f${uid}`, file_unique_id: 'u', width: 1, height: 1 }], caption } } as any);
    },
    async bankDeposit(amount: number, trackingCode: string) {
      return ingestBankTransaction({ externalId: `demo-${trackingCode}`, trackingCode, amount, occurredAt: new Date(), source: 'demo', destination: '6037991122334455' });
    },
    qr: (s: string) => QRCode.toDataURL(s),
    async close() { await panel.stop(); },
  };
}
