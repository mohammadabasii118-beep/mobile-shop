import { randomBytes } from 'node:crypto';
import { env } from '../config/env';
import { hmacSha256, safeEqual, sha256 } from '../utils/misc';
import { getAdmin } from '../modules/admin/rbac';

const LOGIN_TTL_MS = 5 * 60_000;
const SESSION_TTL_MS = 12 * 3_600_000;
export const COOKIE = 'vpn_admin';

const tokens = new Map<string, { telegramId: bigint; exp: number }>();

const secret = () => {
  const e = env();
  const base = e.PANEL_SESSION_SECRET ?? (e.BOT_TOKEN ? sha256(`panel:${e.BOT_TOKEN}`) : undefined);
  if (!base) throw new Error('PANEL_SESSION_SECRET (or BOT_TOKEN) is required for the admin panel');
  return base;
};
export const panelEnabled = () => { try { secret(); return true; } catch { return false; } };

/** One-time login token, 5 minutes, single use. Issued only to authenticated Telegram admins (bot /panel). */
export function createLoginToken(telegramId: bigint): string {
  const t = randomBytes(24).toString('hex');
  tokens.set(sha256(t), { telegramId, exp: Date.now() + LOGIN_TTL_MS });
  for (const [k, v] of tokens) if (v.exp < Date.now()) tokens.delete(k);
  return t;
}
export function consumeLoginToken(token: string): bigint | null {
  const k = sha256(token);
  const v = tokens.get(k);
  tokens.delete(k);
  return v && v.exp > Date.now() ? v.telegramId : null;
}
export function loginUrl(token: string): string {
  const base = (env().APP_URL ?? `http://localhost:${env().PORT}`).replace(/\/+$/, '');
  return `${base}/admin/auth?token=${token}`;
}

export function signSession(telegramId: bigint, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ t: String(telegramId), e: now + SESSION_TTL_MS })).toString('base64url');
  return `${payload}.${hmacSha256(secret(), payload)}`;
}

/** Returns the admin if the cookie is valid AND the admin is still active (re-checked on every request). */
export async function verifySession(cookieHeader: string | undefined, now = Date.now()) {
  const m = cookieHeader?.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  if (!m) return null;
  const [payload, sig] = m.slice(COOKIE.length + 1).split('.');
  if (!payload || !sig || !safeEqual(sig, hmacSha256(secret(), payload))) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { t: string; e: number };
    if (d.e < now) return null;
    const admin = await getAdmin(BigInt(d.t));
    return admin ? { telegramId: BigInt(d.t), role: admin.role } : null;
  } catch { return null; }
}

export const cookieHeader = (value: string, secure: boolean, maxAgeS = SESSION_TTL_MS / 1000) =>
  `${COOKIE}=${value}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAgeS}${secure ? '; Secure' : ''}`;
