import http from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client';
import { createBot } from '../src/bot';
import { createServer } from '../src/server';
import { createLoginToken } from '../src/admin-web/auth';
import { resetPanelRateLimits } from '../src/admin-web/http';
import { categoryTree, createCategory, deleteCategory, ensureCategoryPath, menuLevel, moveCategory, setProductCategory, splitIconName, updateCategory } from '../src/modules/categories/service';
import { createProductsBulk } from '../src/modules/products/service';
import { makeProduct, resetDb, setup } from './helpers';

beforeEach(async () => { await resetDb(); setup(); });

describe('category service', () => {
  it('splits an emoji icon from the name', () => {
    expect(splitIconName('🗓 ماهانه')).toEqual({ icon: '🗓', name: 'ماهانه' });
    expect(splitIconName('👨‍👩‍👧 خانوادگی')).toMatchObject({ name: 'خانوادگی' });
    expect(splitIconName('ساده')).toEqual({ icon: null, name: 'ساده' });
  });
  it('builds a tree up to 3 levels; rejects deeper nesting and same-level duplicates', async () => {
    const a = await createCategory('t', { name: 'ماهانه', icon: '🗓' });
    const b = await createCategory('t', { name: 'حجمی', parentId: a.id });
    const c = await createCategory('t', { name: 'خانوادگی', parentId: b.id });
    await expect(createCategory('t', { name: 'خیلی عمیق', parentId: c.id })).rejects.toThrow(/حداکثر 3/);
    await expect(createCategory('t', { name: 'ماهانه' })).rejects.toMatchObject({ code: 'CONFLICT' });
    await createCategory('t', { name: 'ماهانه', parentId: a.id }); // same name at another level is fine
    const tree = await categoryTree();
    expect(tree.map((t) => [t.depth, t.path])).toEqual([[0, 'ماهانه'], [1, 'ماهانه ▸ حجمی'], [2, 'ماهانه ▸ حجمی ▸ خانوادگی'], [1, 'ماهانه ▸ ماهانه']]);
  });
  it('reorders siblings, toggles, renames, prevents cycles and over-deep moves', async () => {
    const a = await createCategory('t', { name: 'A' }); const b = await createCategory('t', { name: 'B' }); const c = await createCategory('t', { name: 'C' });
    expect((await categoryTree()).map((t) => t.name)).toEqual(['A', 'B', 'C']);
    await moveCategory('t', c.id, 'up'); await moveCategory('t', a.id, 'down');
    expect((await categoryTree()).map((t) => t.name)).toEqual(['C', 'A', 'B']);
    expect(await moveCategory('t', c.id, 'up')).toBe(false); // already first
    await updateCategory('t', a.id, { name: 'A2', icon: '⭐', isActive: false });
    expect(await prisma.category.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ name: 'A2', icon: '⭐', isActive: false });
    const a1 = await createCategory('t', { name: 'A1', parentId: b.id });
    await expect(updateCategory('t', b.id, { parentId: a1.id })).rejects.toThrow(/زیرمجموعه/); // cycle
    await expect(updateCategory('t', b.id, { parentId: b.id })).rejects.toThrow();
    const l2 = await createCategory('t', { name: 'L2', parentId: c.id }); const l3 = await createCategory('t', { name: 'L3', parentId: l2.id });
    await expect(updateCategory('t', b.id, { parentId: l3.id })).rejects.toThrow(/حداکثر 3/); // b has a child => would be level 5
    await updateCategory('t', a1.id, { parentId: null });
    expect((await prisma.category.findUniqueOrThrow({ where: { id: a1.id } })).parentId).toBeNull();
  });
  it('delete: refused with children, otherwise products move up to the parent', async () => {
    const a = await createCategory('t', { name: 'A' }); const b = await createCategory('t', { name: 'B', parentId: a.id });
    const p = await makeProduct(); await setProductCategory('t', p.id, b.id);
    await expect(deleteCategory('t', a.id)).rejects.toThrow(/زیرمجموعه/);
    expect(await deleteCategory('t', b.id)).toEqual({ movedProducts: 1 });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).categoryId).toBe(a.id);
    await deleteCategory('t', a.id);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).categoryId).toBeNull();
    await expect(setProductCategory('t', p.id, 'missing')).rejects.toThrow();
  });
  it('ensureCategoryPath is idempotent', async () => {
    const x = await ensureCategoryPath('t', 'ماهانه ▸ حجمی'); const y = await ensureCategoryPath('t', 'ماهانه/حجمی');
    expect(y).toBe(x); expect(await prisma.category.count()).toBe(2);
  });
  it('customer menu level hides empty and inactive branches and counts active products', async () => {
    const a = await createCategory('t', { name: 'A' }); const empty = await createCategory('t', { name: 'Empty' }); const off = await createCategory('t', { name: 'Off' });
    const sub = await createCategory('t', { name: 'Sub', parentId: a.id });
    const p1 = await makeProduct({ name: 'p1' }); const p2 = await makeProduct({ name: 'p2' }); const p3 = await makeProduct({ name: 'p3', isActive: false }); const p4 = await makeProduct({ name: 'p4' });
    await setProductCategory('t', p1.id, a.id); await setProductCategory('t', p2.id, sub.id); await setProductCategory('t', p3.id, empty.id); await setProductCategory('t', p4.id, off.id);
    await updateCategory('t', off.id, { isActive: false });
    const root = await menuLevel(null);
    expect(root.children.map((c) => [c.name, c.activeProductCount])).toEqual([['A', 2]]);
    expect(root.products).toEqual([]);
    const lvl = await menuLevel(a.id);
    expect(lvl.products.map((p) => p.name)).toEqual(['p1']); expect(lvl.children.map((c) => c.name)).toEqual(['Sub']);
    expect(lvl.crumbs.map((c) => c.name)).toEqual(['A']);
    await expect(menuLevel(off.id)).rejects.toThrow();
  });
  it('bulk import with category= directive creates the path and assigns; category=- returns to root', async () => {
    const made = await createProductsBulk('t', 'inbound=23\ncategory=ماهانه ▸ حجمی\nA | 30 | 50 | 1000\nB | 30 | 100 | 2000\ncategory=-\nC | 7 | 1 | 10');
    const tree = await categoryTree();
    expect(tree.map((t) => t.path)).toEqual(['ماهانه', 'ماهانه ▸ حجمی']);
    const byName = Object.fromEntries(made.map((m) => [m.name, m.categoryId]));
    expect(byName.A).toBe(tree[1].id); expect(byName.B).toBe(tree[1].id); expect(byName.C).toBeNull();
  });
});

describe('Telegram buy menu with categories', () => {
  const USER = 6200, ADMIN = 9000;
  let api: { method: string; payload: any }[] = [];
  let bot: ReturnType<typeof createBot>;
  let uid = 1;
  beforeEach(() => {
    api = [];
    bot = createBot('123:TEST', { botInfo: { id: 123, is_bot: true, first_name: 'B', username: 'b', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false } as any, fetchFile: async () => Buffer.from('x') });
    bot.api.config.use(async (_p, method, payload: any) => { api.push({ method, payload }); return { ok: true, result: method.startsWith('send') || method.startsWith('edit') ? { message_id: api.length, date: 0, chat: { id: payload.chat_id ?? 1, type: 'private' }, text: payload.text } : true } as any; });
  });
  const who = (id: number) => ({ from: { id, is_bot: false, first_name: 'T' }, chat: { id, type: 'private' as const } });
  const say = (id: number, text: string) => bot.handleUpdate({ update_id: uid++, message: { message_id: uid, date: 0, ...who(id), text } } as any);
  const tap = (id: number, data: string) => bot.handleUpdate({ update_id: uid++, callback_query: { id: String(uid), from: who(id).from, chat_instance: 'x', data, message: { message_id: 1, date: 0, chat: who(id).chat, text: 'x' } } } as any);
  const last = () => api.filter((c) => ['sendMessage', 'editMessageText'].includes(c.method)).at(-1)!;
  const btns = () => (last().payload.reply_markup?.inline_keyboard ?? []).flat() as { text: string; callback_data: string }[];
  const cbs = () => btns().map((b) => b.callback_data);

  it('legacy: no categories => flat list exactly as before', async () => {
    const p = await makeProduct({ name: 'ساده' });
    await tap(USER, 'menu:buy');
    expect(cbs()).toContain(`buy:${p.id}`); expect(cbs().some((c) => c.startsWith('bc:'))).toBe(false);
  });

  it('customer navigates ماهانه ▸ حجمی, sees only plans of each level, and back buttons climb one level', async () => {
    const month = await createCategory('t', { name: 'ماهانه', icon: '🗓', description: 'پلن‌های یک‌ماهه' });
    const vol = await createCategory('t', { name: 'حجمی', icon: '📦', parentId: month.id });
    const pm = await makeProduct({ name: 'ماهانه معمولی' }); const pv = await makeProduct({ name: 'حجمی ۱۰۰' }); const pr = await makeProduct({ name: 'ریشه' });
    await setProductCategory('t', pm.id, month.id); await setProductCategory('t', pv.id, vol.id);
    await tap(USER, 'menu:buy');
    expect(btns().map((b) => b.text)).toEqual(expect.arrayContaining(['🗓 ماهانه']));
    expect(cbs()).toEqual(expect.arrayContaining([`bc:${month.id}`, `buy:${pr.id}`])); expect(cbs()).not.toContain(`buy:${pm.id}`);
    await tap(USER, `bc:${month.id}`);
    expect(last().payload.text).toContain('🗓 ماهانه'); expect(last().payload.text).toContain('پلن‌های یک‌ماهه');
    expect(cbs()).toEqual(expect.arrayContaining([`bc:${vol.id}`, `buy:${pm.id}`, 'menu:buy'])); expect(cbs()).not.toContain(`buy:${pv.id}`);
    await tap(USER, `bc:${vol.id}`);
    expect(last().payload.text).toContain('🗓 ماهانه ▸ 📦 حجمی');
    expect(cbs()).toEqual(expect.arrayContaining([`buy:${pv.id}`, `bc:${month.id}`]));
    await tap(USER, `buy:${pv.id}`);
    expect(cbs()).toContain(`bc:${vol.id}`); // summary's back returns to the plan's category
    expect(cbs()).toContain(`bo:${pv.id}`);
    // hidden when inactive; stale deep link is a friendly error, not a crash
    await updateCategory('t', vol.id, { isActive: false });
    await tap(USER, `bc:${vol.id}`);
    expect(last().payload.text).toMatch(/❌|یافت نشد/);
  });

  it('admin manages categories in the bot; non-admins are blocked', async () => {
    await tap(ADMIN, 'adm:home');
    expect(btns().map((b) => b.callback_data)).toContain('adm:g:cat');
    await tap(ADMIN, 'adm:g:cat');
    expect(btns().map((b) => b.callback_data)).toContain('ct:l:root');
    await tap(ADMIN, 'ct:l:root');
    await tap(ADMIN, 'ct:n:root');
    await say(ADMIN, '🗓 ماهانه\n📦 حجمی');
    expect((await categoryTree()).map((t) => t.path)).toEqual(['ماهانه', 'حجمی']);
    const m = (await categoryTree())[0];
    await say(ADMIN, 'x'); // no active step -> fallback, nothing created
    await tap(ADMIN, `ct:n:${m.id}`); await say(ADMIN, 'خانوادگی');
    expect((await categoryTree()).map((t) => t.path)).toContain('ماهانه ▸ خانوادگی');
    await tap(ADMIN, `ct:n:${m.id}`); await say(ADMIN, 'خانوادگی'); // duplicate: friendly error, step kept
    expect(last().payload.text).toContain('وجود دارد');
    await tap(ADMIN, `ct:rn:${m.id}`); await say(ADMIN, '⭐ سالانه');
    expect(await prisma.category.findUniqueOrThrow({ where: { id: m.id } })).toMatchObject({ name: 'سالانه', icon: '⭐' });
    const p = await makeProduct();
    await tap(ADMIN, `pr:c:${p.id}`);
    expect(cbs()).toEqual(expect.arrayContaining([`pr:cs:${p.id}:none`, `pr:cs:${p.id}:${m.id}`]));
    await tap(ADMIN, `pr:cs:${p.id}:${m.id}`);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).categoryId).toBe(m.id);
    await tap(ADMIN, `ct:tg:${m.id}`);
    expect((await prisma.category.findUniqueOrThrow({ where: { id: m.id } })).isActive).toBe(false);
    await tap(ADMIN, `ct:d:${m.id}`);
    expect(last().payload.text).toContain('حذف دسته'); expect(await prisma.category.count()).toBe(3);
    await tap(ADMIN, `ct:d2:${m.id}`); // has a sub-category => refused
    expect(last().payload.text).toContain('زیرمجموعه');
    // non-admin
    await tap(USER, 'ct:l:root'); expect(last().payload.text).toContain('دسترسی غیرمجاز');
    await tap(USER, `ct:d2:${m.id}`); expect(last().payload.text).toContain('دسترسی غیرمجاز');
    expect(await prisma.category.count()).toBe(3);
  });
});

describe('web panel categories API', () => {
  let web: http.Server; let base: string;
  beforeAll(async () => { web = createServer().listen(0, '127.0.0.1'); await new Promise((r) => web.once('listening', r)); base = `http://127.0.0.1:${(web.address() as AddressInfo).port}`; });
  afterAll(() => { web.close(); });
  async function login() { resetPanelRateLimits(); const r = await fetch(`${base}/admin/auth?token=${createLoginToken(9000n)}`, { redirect: 'manual' }); return r.headers.get('set-cookie')!.split(';')[0]; }
  const call = async (c: string, method: string, path: string, body?: unknown) => { const r = await fetch(`${base}/admin/api${path}`, { method, headers: { cookie: c, 'content-type': 'application/json', 'x-requested-with': 'admin-panel' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: (await r.json()) as any }; };

  it('CRUD + move + product assignment + bulk with category; validation and permissions', async () => {
    const c = await login();
    const a = (await call(c, 'POST', '/categories', { name: 'ماهانه', icon: '🗓' })).json;
    const b = (await call(c, 'POST', '/categories', { name: 'حجمی', parentId: a.id })).json;
    expect((await call(c, 'POST', '/categories', { name: 'حجمی', parentId: a.id })).status).toBe(409);
    expect((await call(c, 'POST', '/categories', { name: '' })).status).toBe(400);
    expect((await call(c, 'GET', '/categories')).json.items.map((x: any) => x.path)).toEqual(['ماهانه', 'ماهانه ▸ حجمی']);
    expect((await call(c, 'PATCH', `/categories/${b.id}`, { name: 'حجمی ۲', isActive: false })).json).toMatchObject({ name: 'حجمی ۲', isActive: false });
    expect((await call(c, 'PATCH', `/categories/${a.id}`, { parentId: b.id })).status).toBe(400);
    const p = await makeProduct();
    expect((await call(c, 'PATCH', `/products/${p.id}`, { categoryId: a.id })).json.categoryId).toBe(a.id);
    expect((await call(c, 'PATCH', `/products/${p.id}`, { categoryId: 'nope' })).status).toBe(400);
    const bulk = await call(c, 'POST', '/products/bulk', { text: 'X | 30 | 5 | 100', inbound: 23, category: 'سالانه ▸ ویژه' });
    expect(bulk.json.items[0].categoryId).toBeTruthy();
    expect((await call(c, 'POST', `/categories/${a.id}/move`, { dir: 'down' })).status).toBe(200);
    expect((await call(c, 'DELETE', `/categories/${a.id}`)).status).toBe(400); // has sub-category
    expect((await call(c, 'DELETE', `/categories/${b.id}`)).json).toEqual({ movedProducts: 0 });
    expect((await call(c, 'DELETE', `/categories/${a.id}`)).json.movedProducts).toBe(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).categoryId).toBeNull();
    await prisma.admin.create({ data: { telegramId: 41n, role: 'SUPPORT_ADMIN' } });
    resetPanelRateLimits();
    const r2 = await fetch(`${base}/admin/auth?token=${createLoginToken(41n)}`, { redirect: 'manual' });
    expect((await call(r2.headers.get('set-cookie')!.split(';')[0], 'GET', '/categories')).status).toBe(403);
  });
});
