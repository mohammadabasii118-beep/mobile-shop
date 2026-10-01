import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env';
import { RateLimiter } from '../utils/ratelimit';
import { audit } from '../modules/admin/audit';
import { adminActor } from '../modules/admin/rbac';
import { COOKIE, consumeLoginToken, cookieHeader, panelEnabled, signSession, verifySession } from './auth';
import { dispatch } from './api';

const STATIC_DIR = path.resolve(__dirname, '..', '..', 'public', 'admin');
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const FILES = new Set(['index.html', 'app.js', 'ui.js', 'pages.js', 'charts.js', 'app.css', 'favicon.svg']);

const SEC: Record<string, string> = {
  'content-security-policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; style-src-attr 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'cache-control': 'no-store',
};

let loginLimiter = new RateLimiter(10, 60_000);
let apiLimiter = new RateLimiter(300, 60_000);
/** test helper */
export function resetPanelRateLimits() { loginLimiter = new RateLimiter(10, 60_000); apiLimiter = new RateLimiter(300, 60_000); }

export const clientIp = (req: http.IncomingMessage) =>
  (env().TRUST_PROXY ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '') || String(req.socket.remoteAddress ?? '');

async function readBody(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) { size += (c as Buffer).length; if (size > 65_536) throw Object.assign(new Error('too large'), { status: 413 }); chunks.push(c as Buffer); }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('bad json'), { status: 400 }); }
}

/** Returns true when the request was handled (path under /admin). */
export async function handleAdmin(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const p = new URL(req.url ?? '/', 'http://x').pathname;
  if (p !== '/admin' && !p.startsWith('/admin/')) return false;
  await route(req, res);
  return true;
}

async function route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://x');
  const p = url.pathname;
  const send = (code: number, body: string | Buffer, type = 'application/json', extra: http.OutgoingHttpHeaders = {}) => { res.writeHead(code, { ...SEC, 'content-type': type, ...extra }); res.end(body); };
  const json = (code: number, o: unknown) => send(code, JSON.stringify(o, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
  const ip = clientIp(req);
  const secure = (env().APP_URL ?? '').startsWith('https://');

  try {
    if (p === '/admin') return void send(302, '', 'text/plain', { location: '/admin/' });
    if (p === '/admin/' || p.startsWith('/admin/static/')) {
      const name = p === '/admin/' ? 'index.html' : p.slice('/admin/static/'.length);
      if (!FILES.has(name)) return void send(404, 'not found', 'text/plain');
      const buf = await readFile(path.join(STATIC_DIR, name));
      return void send(200, buf, TYPES[path.extname(name)] ?? 'application/octet-stream', { 'cache-control': name === 'index.html' ? 'no-store' : 'no-cache' });
    }
    if (p === '/admin/auth' && req.method === 'GET') {
      if (!panelEnabled() || !loginLimiter.allow(ip)) return void send(302, '', 'text/plain', { location: '/admin/?login=failed' });
      const tid = consumeLoginToken(url.searchParams.get('token') ?? '');
      if (tid === null) return void send(302, '', 'text/plain', { location: '/admin/?login=failed' });
      const probe = await verifySession(`${COOKIE}=${signSession(tid)}`);
      if (!probe) return void send(302, '', 'text/plain', { location: '/admin/?login=failed' }); // not an active admin
      await audit({ actor: adminActor(tid), action: 'admin.login', target: 'Admin', targetId: String(tid), ip });
      return void send(302, '', 'text/plain', { location: '/admin/', 'set-cookie': cookieHeader(signSession(tid), secure) });
    }
    if (p === '/admin/logout' && req.method === 'POST') return void send(204, '', 'text/plain', { 'set-cookie': cookieHeader('', secure, 0) });

    if (p.startsWith('/admin/api/')) {
      if (!panelEnabled()) return void json(503, { error: 'panel_disabled', message: 'پنل پیکربندی نشده است' });
      if (!apiLimiter.allow(ip)) return void json(429, { error: 'rate_limited', message: 'تعداد درخواست‌ها زیاد است' });
      const admin = await verifySession(req.headers.cookie);
      if (!admin) return void json(401, { error: 'unauthorized', message: 'نیاز به ورود' });
      const method = req.method ?? 'GET';
      if (method !== 'GET' && req.headers['x-requested-with'] !== 'admin-panel') return void json(403, { error: 'csrf', message: 'درخواست نامعتبر' });
      const body = method === 'GET' ? {} : await readBody(req);
      const r = await dispatch(method, p.slice('/admin/api'.length), { admin, query: url.searchParams, body, ip });
      const raw = r.body as any;
      if (r.status === 200 && raw && Buffer.isBuffer(raw.raw)) return void send(200, raw.raw, raw.contentType, { 'content-disposition': 'inline', 'cache-control': 'private, no-store' });
      return void json(r.status, r.body);
    }
    return void send(404, 'not found', 'text/plain');
  } catch (e: any) {
    return void json(e?.status ?? 500, { error: 'error', message: e?.status === 413 ? 'حجم درخواست زیاد است' : e?.status === 400 ? 'درخواست نامعتبر' : 'خطای داخلی سرور' });
  }
}
