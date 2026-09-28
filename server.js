// سرور فروشگاه — بدون وابستگی خارجی (فقط Node.js)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const UPLOADS = path.join(ROOT, 'uploads');
const DB_FILE = path.join(ROOT, 'data', 'db.json');
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ---------- دیتابیس (فایل JSON) ----------
let db;
function loadDb() {
  try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { db = require('./seed')(); saveDb(); }
}
let saving = false;
function saveDb() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
loadDb();

// ---------- ابزارها ----------
const uid = (p = '') => p + crypto.randomBytes(5).toString('hex');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function send(res, code, data, headers = {}) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(body);
}
function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(Object.assign(new Error('حجم درخواست زیاد است'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch { reject(Object.assign(new Error('JSON نامعتبر'), { status: 400 })); } });
    req.on('error', reject);
  });
}
const httpErr = (status, message) => Object.assign(new Error(message), { status });
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const toEnDigits = s => String(s).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

// ---------- احراز هویت ادمین ----------
function hashPw(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
function checkPw(pw, stored) {
  const [salt, h] = stored.split(':');
  const a = Buffer.from(hashPw(pw, salt).split(':')[1], 'hex'), b = Buffer.from(h, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
if (!db.adminHash) { db.adminHash = hashPw(DEFAULT_ADMIN_PASSWORD); saveDb(); }

function sign(payload) {
  const b = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return b + '.' + crypto.createHmac('sha256', SECRET).update(b).digest('base64url');
}
function verify(token) {
  if (!token) return null;
  const [b, s] = token.split('.');
  if (!b || !s) return null;
  const e = crypto.createHmac('sha256', SECRET).update(b).digest('base64url');
  if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null;
  try { const p = JSON.parse(Buffer.from(b, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}
function isAdmin(req) {
  const m = /(?:^|;\s*)admin=([^;]+)/.exec(req.headers.cookie || '');
  return !!verify(m && m[1]);
}
function requireAdmin(req) { if (!isAdmin(req)) throw httpErr(401, 'دسترسی غیرمجاز'); }
const attempts = new Map();
function rateLimit(ip) {
  const now = Date.now(); const a = (attempts.get(ip) || []).filter(t => now - t < 15 * 60 * 1000);
  if (a.length >= 8) throw httpErr(429, 'تلاش بیش از حد. بعداً دوباره امتحان کنید.');
  a.push(now); attempts.set(ip, a);
}

// ---------- آپلود تصویر ----------
function saveImage(dataUrl) {
  const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw httpErr(400, 'فقط تصویر png/jpg/webp مجاز است');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 5 * 1024 * 1024) throw httpErr(413, 'حداکثر حجم تصویر ۵ مگابایت');
  const name = uid('img-') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  return '/uploads/' + name;
}

// ---------- منطق سفارش ----------
function publicSettings() {
  const { zarinpalMerchant, ...rest } = db.settings;
  return { ...rest, zarinpalEnabled: true };
}
function priceOrder(items) {
  const lines = [];
  for (const it of items || []) {
    const p = db.products.find(x => x.id === it.productId && x.active);
    if (!p) throw httpErr(400, 'یکی از محصولات موجود نیست');
    const qty = Math.max(1, Math.min(20, Math.floor(num(it.qty, 1))));
    if (p.stock < qty) throw httpErr(400, `موجودی «${p.name}» کافی نیست`);
    const sel = {};
    for (const o of p.options || []) {
      const v = it.selected && it.selected[o.name];
      if (!o.values.includes(v)) throw httpErr(400, `لطفاً ${o.name} «${p.name}» را انتخاب کنید`);
      sel[o.name] = v;
    }
    lines.push({ productId: p.id, name: p.name, price: p.price, qty, selected: sel });
  }
  if (!lines.length) throw httpErr(400, 'سبد خرید خالی است');
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const shipping = subtotal >= db.settings.freeShippingOver ? 0 : db.settings.shipping;
  return { lines, subtotal, shipping, total: subtotal + shipping };
}
function adjustStock(order, dir) {
  for (const l of order.items) {
    const p = db.products.find(x => x.id === l.productId);
    if (p) { p.stock += dir * l.qty; p.sold += -dir * l.qty; if (p.stock < 0) p.stock = 0; }
  }
}
function markPaid(order, extra = {}) {
  if (order.status === 'paid' || order.paidAt) return;
  Object.assign(order, extra, { status: 'paid', paidAt: Date.now() });
  adjustStock(order, -1);
  order.stockReduced = true;
  saveDb();
}
const publicOrder = o => { const { authority, ...r } = o; return r; };

function zarinpal(pathname, body) {
  const sandbox = db.settings.zarinpalSandbox;
  const host = sandbox ? 'sandbox.zarinpal.com' : 'payment.zarinpal.com';
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const r = https.request({ host, path: '/pg/v4/payment/' + pathname, method: 'POST', timeout: 15000,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      resp => { let s = ''; resp.on('data', c => s += c); resp.on('end', () => { try { resolve(JSON.parse(s)); } catch { reject(new Error('پاسخ نامعتبر از درگاه')); } }); });
    r.on('error', reject); r.on('timeout', () => r.destroy(new Error('timeout')));
    r.end(data);
  });
}

// ---------- مسیرها ----------
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler });

route('GET', '/api/shop', async () => ({
  settings: publicSettings(), categories: db.categories.slice().sort((a, b) => a.order - b.order),
  banners: db.banners, products: db.products.filter(p => p.active),
}));

route('POST', '/api/orders', async (req, res, ctx) => {
  const b = ctx.body;
  const c = { name: str(b.name, 80), phone: toEnDigits(str(b.phone, 20)), address: str(b.address, 400), city: str(b.city, 60), postal: toEnDigits(str(b.postal, 12)) };
  if (!c.name || !/^09\d{9}$/.test(c.phone) || c.address.length < 8 || !c.city) throw httpErr(400, 'اطلاعات تحویل ناقص یا نامعتبر است');
  if (!['zarinpal', 'card'].includes(b.method)) throw httpErr(400, 'روش پرداخت نامعتبر است');
  const priced = priceOrder(b.items);
  const order = { id: uid('o-'), code: String(Date.now()).slice(-8) + crypto.randomInt(10, 99), items: priced.lines, subtotal: priced.subtotal,
    shipping: priced.shipping, total: priced.total, customer: c, method: b.method, note: str(b.note, 300),
    status: b.method === 'card' ? 'awaiting_receipt' : 'pending_payment', createdAt: Date.now() };
  db.orders.unshift(order); saveDb();
  if (b.method === 'card') return { order: publicOrder(order) };

  const merchant = db.settings.zarinpalMerchant;
  const origin = `${ctx.proto}://${req.headers.host}`;
  if (!merchant) return { order: publicOrder(order), payUrl: `/pay-demo.html?code=${order.code}` }; // حالت آزمایشی
  try {
    const r = await zarinpal('request.json', { merchant_id: merchant, amount: order.total * 10, currency: 'IRR',
      callback_url: `${origin}/api/pay/callback?code=${order.code}`, description: `سفارش ${order.code}`, metadata: { mobile: c.phone } });
    if (r.data && r.data.code === 100) {
      order.authority = r.data.authority; saveDb();
      const base = db.settings.zarinpalSandbox ? 'sandbox.zarinpal.com' : 'www.zarinpal.com';
      return { order: publicOrder(order), payUrl: `https://${base}/pg/StartPay/${r.data.authority}` };
    }
    throw new Error('درگاه خطا داد');
  } catch (e) {
    throw httpErr(502, 'اتصال به درگاه پرداخت برقرار نشد؛ می‌توانید کارت‌به‌کارت را انتخاب کنید. کد سفارش: ' + order.code);
  }
});

route('GET', '/api/pay/callback', async (req, res, ctx) => {
  const order = db.orders.find(o => o.code === ctx.query.get('code'));
  const back = c => { res.writeHead(302, { Location: `/#/order/${order ? order.code : ''}?pay=${c}` }); res.end(); return null; };
  if (!order) return back('fail');
  if (order.status === 'paid') return back('ok');
  if (ctx.query.get('Status') !== 'OK' || ctx.query.get('Authority') !== order.authority) return back('fail');
  try {
    const r = await zarinpal('verify.json', { merchant_id: db.settings.zarinpalMerchant, amount: order.total * 10, authority: order.authority });
    if (r.data && (r.data.code === 100 || r.data.code === 101)) { markPaid(order, { refId: String(r.data.ref_id) }); return back('ok'); }
  } catch {}
  return back('fail');
});

// درگاه آزمایشی (فقط وقتی مرچنت تنظیم نشده)
route('POST', '/api/pay/demo', async (req, res, ctx) => {
  if (db.settings.zarinpalMerchant) throw httpErr(403, 'حالت آزمایشی غیرفعال است');
  const order = db.orders.find(o => o.code === ctx.body.code);
  if (!order || order.method !== 'zarinpal') throw httpErr(404, 'سفارش پیدا نشد');
  if (ctx.body.ok) markPaid(order, { refId: 'DEMO' + crypto.randomInt(1000, 9999) });
  return { ok: !!ctx.body.ok };
});

route('POST', '/api/orders/:code/receipt', async (req, res, ctx) => {
  const order = db.orders.find(o => o.code === ctx.params.code && o.customer.phone === toEnDigits(str(ctx.body.phone)));
  if (!order || order.method !== 'card') throw httpErr(404, 'سفارش پیدا نشد');
  if (order.status === 'paid') throw httpErr(400, 'این سفارش قبلاً تایید شده');
  if (ctx.body.image) order.receipt = saveImage(ctx.body.image);
  order.trackingNo = str(ctx.body.trackingNo, 40);
  if (!order.receipt && !order.trackingNo) throw httpErr(400, 'تصویر رسید یا شماره پیگیری را وارد کنید');
  order.status = 'awaiting_review'; saveDb();
  return { order: publicOrder(order) };
});

route('GET', '/api/orders/:code', async (req, res, ctx) => {
  const order = db.orders.find(o => o.code === ctx.params.code && o.customer.phone === toEnDigits(ctx.query.get('phone') || ''));
  if (!order) throw httpErr(404, 'سفارشی با این مشخصات پیدا نشد');
  return { order: publicOrder(order) };
});

// --- ادمین ---
route('POST', '/api/admin/login', async (req, res, ctx) => {
  rateLimit(req.socket.remoteAddress);
  if (!checkPw(str(ctx.body.password, 100), db.adminHash)) throw httpErr(401, 'رمز عبور اشتباه است');
  const token = sign({ exp: Date.now() + 12 * 3600 * 1000 });
  return [{ ok: true, defaultPassword: checkPw('admin123', db.adminHash) }, { 'Set-Cookie': `admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200` }];
});
route('POST', '/api/admin/logout', async () => [{ ok: true }, { 'Set-Cookie': 'admin=; HttpOnly; Path=/; Max-Age=0' }]);
route('GET', '/api/admin/me', async (req) => { requireAdmin(req); return { ok: true }; });
route('POST', '/api/admin/password', async (req, res, ctx) => {
  requireAdmin(req);
  const p = str(ctx.body.password, 100);
  if (p.length < 8) throw httpErr(400, 'رمز باید حداقل ۸ کاراکتر باشد');
  db.adminHash = hashPw(p); saveDb(); return { ok: true };
});
route('GET', '/api/admin/data', async (req) => {
  requireAdmin(req);
  const day = 864e5, now = Date.now();
  const paid = db.orders.filter(o => o.status !== 'canceled' && (o.status === 'paid' || o.paidAt || ['processing', 'shipped', 'delivered'].includes(o.status)));
  return { settings: db.settings, categories: db.categories, banners: db.banners, products: db.products, orders: db.orders,
    stats: { orders: db.orders.length, pending: db.orders.filter(o => o.status === 'awaiting_review').length,
      revenue: paid.reduce((s, o) => s + o.total, 0), revenue30: paid.filter(o => now - o.createdAt < 30 * day).reduce((s, o) => s + o.total, 0),
      lowStock: db.products.filter(p => p.stock <= 5).length } };
});
route('POST', '/api/admin/upload', async (req, res, ctx) => { requireAdmin(req); return { url: saveImage(ctx.body.image) }; });
route('PUT', '/api/admin/settings', async (req, res, ctx) => {
  requireAdmin(req);
  const b = ctx.body, s = db.settings;
  for (const k of ['shopName', 'phone', 'cardNumber', 'cardOwner', 'bankName', 'zarinpalMerchant']) if (k in b) s[k] = str(b[k], 100);
  if ('zarinpalSandbox' in b) s.zarinpalSandbox = !!b.zarinpalSandbox;
  if ('shipping' in b) s.shipping = Math.max(0, num(b.shipping));
  if ('freeShippingOver' in b) s.freeShippingOver = Math.max(0, num(b.freeShippingOver));
  const links = arr => (Array.isArray(arr) ? arr : []).slice(0, 12).map(x => ({ title: str(x.title, 40), link: str(x.link, 100), icon: str(x.icon, 8), gradient: str(x.gradient, 200), image: str(x.image, 200) }));
  if ('boxes' in b) s.boxes = links(b.boxes);
  if ('rail' in b) s.rail = links(b.rail);
  saveDb(); return { settings: s };
});

// CRUD عمومی برای دسته‌ها، بنرها، محصولات
function crud(name, coll, clean) {
  route('POST', `/api/admin/${name}`, async (req, res, ctx) => { requireAdmin(req); const it = { id: uid(name[0] + '-'), ...clean(ctx.body) }; db[coll].push(it); saveDb(); return it; });
  route('PUT', `/api/admin/${name}/:id`, async (req, res, ctx) => {
    requireAdmin(req); const i = db[coll].findIndex(x => x.id === ctx.params.id);
    if (i < 0) throw httpErr(404, 'پیدا نشد');
    db[coll][i] = { ...db[coll][i], ...clean(ctx.body, db[coll][i]) }; saveDb(); return db[coll][i];
  });
  route('DELETE', `/api/admin/${name}/:id`, async (req, res, ctx) => {
    requireAdmin(req);
    if (coll === 'categories' && db.categories.some(c => c.parent === ctx.params.id)) throw httpErr(400, 'ابتدا زیرمجموعه‌ها را حذف کنید');
    if (coll === 'categories' && db.products.some(p => p.category === ctx.params.id)) throw httpErr(400, 'در این دسته محصول وجود دارد');
    db[coll] = db[coll].filter(x => x.id !== ctx.params.id); saveDb(); return { ok: true };
  });
}
crud('category', 'categories', b => {
  const parent = b.parent || null;
  if (parent && !db.categories.some(c => c.id === parent)) throw httpErr(400, 'دسته والد نامعتبر');
  if (!str(b.name)) throw httpErr(400, 'نام دسته الزامی است');
  return { name: str(b.name, 60), parent, icon: str(b.icon, 8) || '📦', order: num(b.order, db.categories.length) };
});
crud('banner', 'banners', b => {
  if (!str(b.title)) throw httpErr(400, 'عنوان بنر الزامی است');
  return { title: str(b.title, 80), subtitle: str(b.subtitle, 160), cta: str(b.cta, 30), link: str(b.link, 200) || '#/', gradient: str(b.gradient, 200) || 'linear-gradient(135deg,#7c3aed,#ec4899)', icon: str(b.icon, 8), image: str(b.image, 200) };
});
crud('product', 'products', (b, old) => {
  if (!str(b.name)) throw httpErr(400, 'نام محصول الزامی است');
  if (!db.categories.some(c => c.id === b.category)) throw httpErr(400, 'دسته‌بندی نامعتبر');
  const options = (Array.isArray(b.options) ? b.options : []).map(o => ({ name: str(o.name, 30), values: [...new Set((o.values || []).map(v => str(v, 40)).filter(Boolean))] })).filter(o => o.name && o.values.length);
  const price = Math.max(0, num(b.price)), oldPrice = Math.max(0, num(b.oldPrice));
  return { name: str(b.name, 120), category: b.category, price, oldPrice: oldPrice > price ? oldPrice : 0, stock: Math.max(0, Math.floor(num(b.stock))),
    desc: str(b.desc, 2000), images: (Array.isArray(b.images) ? b.images : []).map(i => str(i, 200)).filter(i => i.startsWith('/uploads/') || /^https?:\/\//.test(i)).slice(0, 8),
    options, active: b.active !== false, sold: old ? old.sold : Math.max(0, num(b.sold)), createdAt: old ? old.createdAt : Date.now() };
});

const STATUSES = ['pending_payment', 'awaiting_receipt', 'awaiting_review', 'paid', 'processing', 'shipped', 'delivered', 'canceled'];
route('PUT', '/api/admin/orders/:id', async (req, res, ctx) => {
  requireAdmin(req);
  const o = db.orders.find(x => x.id === ctx.params.id); if (!o) throw httpErr(404, 'سفارش پیدا نشد');
  const st = ctx.body.status;
  if (st) {
    if (!STATUSES.includes(st)) throw httpErr(400, 'وضعیت نامعتبر');
    if (['paid', 'processing', 'shipped', 'delivered'].includes(st) && !o.stockReduced) { o.paidAt = o.paidAt || Date.now(); adjustStock(o, -1); o.stockReduced = true; }
    if (st === 'canceled' && o.stockReduced) { adjustStock(o, 1); o.stockReduced = false; }
    o.status = st;
  }
  if ('adminNote' in ctx.body) o.adminNote = str(ctx.body.adminNote, 500);
  if ('postTracking' in ctx.body) o.postTracking = str(ctx.body.postTracking, 60);
  saveDb(); return o;
});
route('DELETE', '/api/admin/orders/:id', async (req, res, ctx) => {
  requireAdmin(req); db.orders = db.orders.filter(o => o.id !== ctx.params.id); saveDb(); return { ok: true };
});

// ---------- سرور ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const secure = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' };
  try {
    if (url.pathname.startsWith('/api/')) {
      const r = routes.find(r => r.method === req.method && r.re.test(url.pathname));
      if (!r) return send(res, 404, { error: 'مسیر پیدا نشد' }, secure);
      const ctx = { query: url.searchParams, params: r.re.exec(url.pathname).groups || {}, body: {}, proto: req.headers['x-forwarded-proto'] || 'http' };
      if (['POST', 'PUT'].includes(req.method)) ctx.body = await readBody(req);
      let out = await r.handler(req, res, ctx);
      if (out === null) return; // پاسخ توسط هندلر داده شده
      let headers = secure;
      if (Array.isArray(out)) { headers = { ...secure, ...out[1] }; out = out[0]; }
      return send(res, 200, out, { ...headers, 'Cache-Control': 'no-store' });
    }
    // فایل‌های استاتیک
    let file = decodeURIComponent(url.pathname);
    let base = PUBLIC;
    if (file.startsWith('/uploads/')) { base = UPLOADS; file = file.slice(8); }
    if (file === '/admin') file = '/admin.html';
    if (file.endsWith('/') || file === '') file += 'index.html';
    const full = path.join(base, file);
    if (!full.startsWith(base + path.sep) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404, secure); return res.end('Not found'); }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, { ...secure, 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': base === UPLOADS ? 'public, max-age=86400' : 'no-cache' });
    fs.createReadStream(full).pipe(res);
  } catch (e) {
    if (!e.status) console.error(e);
    send(res, e.status || 500, { error: e.status ? e.message : 'خطای سرور' }, secure);
  }
});
server.listen(PORT, () => console.log(`فروشگاه روی http://localhost:${PORT} اجرا شد — پنل مدیریت: /admin`));
