import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TgUser { tgId: number; name: string; avatar: string | null }

const MAX_AGE_SEC = 24 * 3600;
const lastWarn = new Map<string, number>();
/** دلیل رد شدن ورود را (حداکثر دقیقه‌ای یک‌بار برای هر دلیل) در لاگ می‌نویسد؛ بدون هیچ داده‌ی محرمانه */
function warn(msg: string) {
  const t = Date.now();
  if ((lastWarn.get(msg) ?? 0) + 60_000 > t) return;
  lastWarn.set(msg, t);
  console.warn(`[auth] ${msg}`);
}

/** اعتبارسنجی initData تلگرام طبق مستندات رسمی (HMAC-SHA256 با کلید مشتق از توکن ربات). */
export function validateInitData(initData: string, botToken: string, nowSec = Math.floor(Date.now() / 1000)): TgUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) { warn('initData بدون hash (برنامه بیرون از تلگرام باز شده؟)'); return null; }
  params.delete('hash');
  const check = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(check).digest();
  let given: Buffer;
  try { given = Buffer.from(hash, 'hex'); } catch { return null; }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) { warn('امضای initData نامعتبر: توکن BOT_TOKEN با ربات بازکننده‌ی بازی یکی نیست'); return null; }
  const authDate = Number(params.get('auth_date'));
  if (!authDate || nowSec - authDate > MAX_AGE_SEC) { warn('initData منقضی شده یا ساعت سرور اشتباه است'); return null; }
  try {
    const u = JSON.parse(params.get('user') ?? '');
    if (typeof u.id !== 'number') return null;
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || `Player${u.id}`;
    return { tgId: u.id, name, avatar: u.photo_url ?? null };
  } catch { return null; }
}

export interface AuthOptions { botToken?: string; devAuth: boolean }

/** initData واقعی تلگرام، یا (فقط در حالت dev) رشته‌ی `dev:<id>:<name>` */
export function authenticate(initData: string | undefined, opt: AuthOptions): TgUser | null {
  if (!initData) return null;
  if (opt.devAuth && initData.startsWith('dev:')) {
    const [, id, ...rest] = initData.split(':');
    const tgId = Number(id);
    if (!Number.isInteger(tgId) || tgId <= 0) return null;
    let name = rest.join(':');
    try { name = decodeURIComponent(name); } catch { /* نام خام */ }
    return { tgId, name: name.slice(0, 40) || `Player${tgId}`, avatar: null };
  }
  if (!opt.botToken) { warn('ورود رد شد: هویت آزمایشی (dev) در حالت واقعی قبول نمی‌شود؛ بازی باید از داخل تلگرام باز شود'); return null; }
  if (initData.startsWith('dev:')) { warn('ورود رد شد: هویت آزمایشی (dev) در حالت واقعی قبول نمی‌شود؛ احتمالاً اسکریپت تلگرام لود نشده'); return null; }
  return validateInitData(initData, opt.botToken);
}
