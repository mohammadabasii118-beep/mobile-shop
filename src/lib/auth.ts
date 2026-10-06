import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DATA_DIR, get } from './db';
export { hashPassword, verifyPassword } from './password';

export type SessionUser = { id: number; name: string; login: string; role: 'admin' | 'customer' };

const COOKIE = 'vt_session';
const MAX_AGE = 60 * 60 * 24 * 14;

function secret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const f = path.join(DATA_DIR, '.session-secret');
  try {
    return fs.readFileSync(f, 'utf8');
  } catch {
    const s = crypto.randomBytes(48).toString('hex');
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(f, s, { mode: 0o600 });
    return s;
  }
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const sign = (data: string) => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

export async function createSession(userId: number) {
  const payload = b64(JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE * 1000 }));
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES !== '1',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getUser(): Promise<SessionUser | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof uid !== 'number' || exp < Date.now()) return null;
    const u = get<SessionUser & { active: number }>('SELECT id, name, login, role, active FROM users WHERE id = ?', uid);
    return u && u.active ? { id: u.id, name: u.name, login: u.login, role: u.role } : null;
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await getUser();
  if (!u || u.role !== 'admin') redirect('/admin/login');
  return u;
}

/** برای Server Actionها و Route Handlerها: بدون redirect، خطا پرتاب می‌کند */
export async function assertAdmin(): Promise<SessionUser> {
  const u = await getUser();
  if (!u || u.role !== 'admin') throw new Error('دسترسی غیرمجاز');
  return u;
}

// محدودیت تلاش ورود (در حافظه)
const attempts = new Map<string, { n: number; t: number }>();
export function loginAllowed(key: string): boolean {
  const a = attempts.get(key);
  if (!a || Date.now() - a.t > 10 * 60_000) return true;
  return a.n < 6;
}
export function loginFailed(key: string) {
  const a = attempts.get(key);
  if (!a || Date.now() - a.t > 10 * 60_000) attempts.set(key, { n: 1, t: Date.now() });
  else a.n++;
}
export function loginOk(key: string) {
  attempts.delete(key);
}
