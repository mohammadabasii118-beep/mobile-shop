import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client';
import { createBot } from '../src/bot';
import { createProductsBulk, parseProductField, parseProductLines } from '../src/modules/products/service';
import { makeOrder, makeProduct, makeUser, resetDb, setup } from './helpers';

describe('bulk product parser', () => {
  it('parses lines with defaults, Persian digits, thousands separators, descriptions, comments', () => {
    const { items, errors } = parseProductLines(`
# comment
inbound=23 protocol=VLESS
اقتصادی ۵۰ گیگ | ۳۰ | ۵۰ | ۲۵۰٬۰۰۰
ویژه | 60 | 100 | 450,000 | 25 | TROJAN | مناسب خانواده
\tتب‌جدا\t7\t1\t1000
`);
    expect(errors).toEqual([]);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ name: 'اقتصادی ۵۰ گیگ', durationDays: 30, trafficGB: 50, price: 250000, xuiInboundId: 23, protocol: 'VLESS' });
    expect(items[1]).toMatchObject({ price: 450000, xuiInboundId: 25, protocol: 'TROJAN', description: 'مناسب خانواده' });
    expect(items[2]).toMatchObject({ name: 'تب‌جدا', durationDays: 7, price: 1000, xuiInboundId: 23 });
  });
  it('reports every bad line with its number', () => {
    const { items, errors } = parseProductLines('a|30|50|1000\nb|x|50|1000|23\nc|30|50\nd|30|50|1000|23|WAT\ne|30|50|1000|23|VLESS|x|y');
    expect(items).toHaveLength(0);
    expect(errors.join('\n')).toMatch(/خط 1: inbound مشخص نشده/);
    expect(errors.join('\n')).toMatch(/خط 2: روز نامعتبر/);
    expect(errors.join('\n')).toMatch(/خط 3: حداقل ۴ بخش/);
    expect(errors.join('\n')).toMatch(/خط 4: پروتکل/);
    expect(errors.join('\n')).toMatch(/خط 5: بیش از ۷ بخش/);
  });
  it('single-field edit parsing validates like create', () => {
    expect(parseProductField('price', '۲۵۰٬۰۰۰')).toEqual({ price: 250000 });
    expect(parseProductField('name', ' پلن نو ')).toEqual({ name: 'پلن نو' });
    expect(parseProductField('description', '-')).toEqual({ description: '' });
    for (const [f, v] of [['price', 'abc'], ['trafficGB', '0'], ['durationDays', '99999'], ['xuiInboundId', '-3'], ['name', '   ']] as const) expect(() => parseProductField(f, v)).toThrow();
  });
});

beforeEach(async () => { await resetDb(); setup(); });

describe('bulk create service', () => {
  it('creates all lines in order, audits once; all-or-nothing on errors; exact duplicates (double paste) rejected', async () => {
    const txt = 'inbound=23\nA | 30 | 50 | 1000\nB | 30 | 100 | 2000\nC | 60 | 100 | 3000';
    const made = await createProductsBulk('admin:1', txt);
    expect(made.map((m) => m.name)).toEqual(['A', 'B', 'C']);
    expect(made.map((m) => m.sortOrder)).toEqual([1, 2, 3]);
    expect(await prisma.auditLog.count({ where: { action: 'product.bulk_create' } })).toBe(1);
    await expect(createProductsBulk('admin:1', txt)).rejects.toThrow(/تکراری/);
    await expect(createProductsBulk('admin:1', 'inbound=23\nD | 30 | 50 | 1000\nbad line')).rejects.toThrow(/هیچ محصولی ثبت نشد/);
    expect(await prisma.product.count()).toBe(3); // nothing from the failed paste
    await expect(createProductsBulk('admin:1', 'inbound=23\nX | 30 | 50 | 1000\nX | 30 | 50 | 1000')).rejects.toThrow(/تکراری/);
    await expect(createProductsBulk('admin:1', '   ')).rejects.toThrow();
  });
});

describe('regression: partial edits must not reset untouched fields', () => {
  it('changing only the price keeps protocol, active flag, sort order, provider and currency', async () => {
    const { updateProduct } = await import('../src/modules/products/service');
    const p = await makeProduct({ protocol: 'TROJAN', isActive: false, sortOrder: 9, xuiProviderId: 'other' });
    await updateProduct('admin:1', p.id, { price: 111 });
    expect(await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ price: 111, protocol: 'TROJAN', isActive: false, sortOrder: 9, xuiProviderId: 'other' });
  });
});

describe('Telegram: admin entry in the menu + product management', () => {
  const ADMIN = 9000, USER = 6100;
  let api: { method: string; payload: any }[] = [];
  let bot: ReturnType<typeof createBot>;
  let uid = 1;
  beforeEach(() => {
    api = [];
    bot = createBot('123:TEST', { botInfo: { id: 123, is_bot: true, first_name: 'B', username: 'b', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false } as any, fetchFile: async () => Buffer.from('x') });
    bot.api.config.use(async (_p, method, payload: any) => { api.push({ method, payload }); return { ok: true, result: method.startsWith('send') || method.startsWith('edit') ? { message_id: api.length, date: 0, chat: { id: payload.chat_id ?? 1, type: 'private' }, text: payload.text } : true } as any; });
  });
  const who = (id: number) => ({ from: { id, is_bot: false, first_name: 'T' }, chat: { id, type: 'private' as const } });
  const say = (id: number, text: string) => bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, ...who(id), text, entities: text.startsWith('/') ? [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] : undefined } } as any);
  const tap = (id: number, data: string) => bot.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from: who(id).from, chat_instance: 'x', data, message: { message_id: 1, date: 0, chat: who(id).chat, text: 'x' } } } as any);
  const last = () => api.filter((c) => ['sendMessage', 'editMessageText'].includes(c.method)).at(-1)!;
  const labels = () => (last().payload.reply_markup?.inline_keyboard ?? []).flat().map((b: any) => b.text) as string[];
  const cbs = () => (last().payload.reply_markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data) as string[];

  it('the management button exists ONLY in admins\' menu; non-admins cannot open it by crafted callback', async () => {
    await say(USER, '/start');
    expect(labels()).not.toContain('🛠 پنل مدیریت'); expect(labels()).toHaveLength(8);
    await say(ADMIN, '/start');
    expect(labels()).toContain('🛠 پنل مدیریت'); expect(cbs()).toContain('adm:home');
    await tap(USER, 'adm:home');
    expect(last().payload.text).toContain('دسترسی غیرمجاز');
    await tap(USER, 'pr:d2:whatever');
    expect(last().payload.text).toContain('دسترسی غیرمجاز');
    // fallbacks keep the same visibility rules
    await say(USER, 'hello'); expect(labels()).not.toContain('🛠 پنل مدیریت');
    await say(ADMIN, 'hello'); expect(labels()).toContain('🛠 پنل مدیریت');
    // admin panel itself
    await tap(ADMIN, 'adm:home');
    expect(last().payload.text).toContain('پنل مدیریت');
    expect(labels()).toEqual(expect.arrayContaining(['📊 داشبورد', '💰 فروش و مالی', '📦 محصولات و منوی خرید', '🛰 سرویس‌ها و سرورها', '⚙️ تنظیمات و ابزارها', '🎫 پشتیبانی']));
    expect(labels()).not.toContain('📦 محصولات'); // leaf items live inside their group
    await tap(ADMIN, 'adm:g:cat'); expect(labels()).toEqual(expect.arrayContaining(['📦 محصولات', '🗂 دسته‌بندی منوی خرید']));
    await tap(ADMIN, 'adm:g:fin'); expect(cbs()).toEqual(expect.arrayContaining(['adm:pays', 'adm:orders', 'adm:coupons']));
    await tap(ADMIN, 'adm:g:nope'); expect(last().payload.text).toContain('نامعتبر');
  });

  it('bulk add via bot: bad paste keeps the step (retry), corrected paste creates everything', async () => {
    await tap(ADMIN, 'adm:products');
    expect(cbs()).toEqual(expect.arrayContaining(['pr:new', 'pr:bulk']));
    await tap(ADMIN, 'pr:bulk');
    expect(last().payload.text).toContain('افزودن گروهی'); expect(last().payload.text).toContain('inbound=23');
    await say(ADMIN, 'inbound=23\nA | 30 | 50 | 1000\nB | سی | 50 | 2000');
    expect(last().payload.text).toContain('خط 3: روز نامعتبر');
    expect(await prisma.product.count()).toBe(0);
    await say(ADMIN, 'inbound=23\nA | 30 | 50 | 1000\nB | 30 | 50 | 2000');
    expect(await prisma.product.count()).toBe(2);
    expect(last().payload.text).toContain('2 محصول ثبت شد');
  });

  it('full edit: every field + protocol; toggle; delete asks confirmation; used products are protected', async () => {
    const p = await makeProduct({ name: 'قدیمی' });
    await tap(ADMIN, `pr:v:${p.id}`);
    expect(cbs()).toEqual(expect.arrayContaining([`pr:e:${p.id}`, `pr:d:${p.id}`, `pr:tg:${p.id}`]));
    await tap(ADMIN, `pr:e:${p.id}`);
    expect(cbs()).toEqual(expect.arrayContaining([`pr:f:${p.id}:name`, `pr:f:${p.id}:price`, `pr:f:${p.id}:trafficGB`, `pr:f:${p.id}:durationDays`, `pr:f:${p.id}:xuiInboundId`, `pr:f:${p.id}:sortOrder`, `pr:f:${p.id}:description`, `pr:pt:${p.id}`]));
    const edit = async (field: string, text: string) => { await tap(ADMIN, `pr:f:${p.id}:${field}`); await say(ADMIN, text); };
    await edit('name', 'جدید'); await edit('price', '۳۰۰٬۰۰۰'); await edit('trafficGB', '80'); await edit('durationDays', '45'); await edit('xuiInboundId', '25'); await edit('sortOrder', '7'); await edit('description', 'توضیح نو');
    expect(await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ name: 'جدید', price: 300000, trafficGB: 80, durationDays: 45, xuiInboundId: 25, sortOrder: 7, description: 'توضیح نو' });
    await tap(ADMIN, `pr:f:${p.id}:price`); await say(ADMIN, 'abc');
    expect(last().payload.text).toContain('نامعتبر');
    await say(ADMIN, '123000'); // step kept after a validation error
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).price).toBe(123000);
    await tap(ADMIN, `pr:ps:${p.id}:TROJAN`);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).protocol).toBe('TROJAN');
    await tap(ADMIN, `pr:tg:${p.id}`);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).isActive).toBe(false);
    expect((await prisma.auditLog.findMany()).map((a) => a.action)).toEqual(expect.arrayContaining(['product.update', 'product.price_change']));
    // delete: confirmation first, product used by an order is protected, unused is deleted
    const u = await makeUser(); await makeOrder(u.id, p.id).catch(() => undefined);
    await prisma.order.create({ data: { orderNumber: 'VPN-X-1', userId: u.id, productId: p.id, amount: 1, finalAmount: 1, paymentMethod: 'CARD_TO_CARD' } });
    await tap(ADMIN, `pr:d:${p.id}`);
    expect(last().payload.text).toContain('حذف محصول'); expect(await prisma.product.count()).toBe(1);
    await tap(ADMIN, `pr:d2:${p.id}`);
    expect(last().payload.text).toContain('استفاده شده'); expect(await prisma.product.count()).toBe(1);
    const free = await makeProduct({ name: 'آزاد' });
    await tap(ADMIN, `pr:d2:${free.id}`);
    expect(await prisma.product.count()).toBe(1);
    expect((await prisma.auditLog.findMany()).map((a) => a.action)).toContain('product.delete');
  });
});
