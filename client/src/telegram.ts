declare global {
  interface Window {
    Telegram?: { WebApp?: { initData: string; ready(): void; expand(): void; setHeaderColor?(c: string): void; setBackgroundColor?(c: string): void; openInvoice?(url: string, cb?: (status: string) => void): void; HapticFeedback?: { impactOccurred(s: string): void }; openTelegramLink?(url: string): void; openLink?(url: string): void; disableVerticalSwipes?(): void; enableClosingConfirmation?(): void; disableClosingConfirmation?(): void } };
  }
}

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
try { tg?.setHeaderColor?.('#0a1124'); tg?.setBackgroundColor?.('#0a1124'); } catch { /* ignore */ }
// کشیدن انگشت به پایین بازی را نبندد/کوچک نکند (وسط نبرد که با انگشت روی کارت‌ها می‌کشی مهم است)
try { tg?.disableVerticalSwipes?.(); } catch { /* نسخه‌ی قدیمی تلگرام */ }

/** داخل تلگرام: initData واقعی. بیرون از تلگرام (فقط دمو/توسعه): کاربر آزمایشی. ?u=2 برای کاربر دوم */
function devIdentity() {
  const q = new URLSearchParams(location.search).get('u');
  let id = q ?? localStorage.getItem('devId');
  if (!id) id = String(1000 + Math.floor(Math.random() * 9000));
  if (!q) localStorage.setItem('devId', id);
  return `dev:${id}:${encodeURIComponent(`بازیکن ${id}`)}`;
}

/** منبع هویت (برای عیب‌یابی): اسکریپت تلگرام، هش لینک، حافظه‌ی نشست، یا هویت آزمایشی */
export let initSource: 'telegram' | 'hash' | 'session' | 'dev' = 'dev';

/** هویت تلگرام: از اسکریپت رسمی؛ اگر لود نشد (مثلاً telegram.org فیلتر بود) مستقیم از هش لینک (#tgWebAppData=…) */
function telegramInitData(): string {
  if (tg?.initData) { initSource = 'telegram'; return tg.initData; }
  try {
    const fromHash = new URLSearchParams(location.hash.slice(1)).get('tgWebAppData');
    if (fromHash) { sessionStorage.setItem('tgInit', fromHash); initSource = 'hash'; return fromHash; }
    const kept = sessionStorage.getItem('tgInit') ?? '';
    if (kept) initSource = 'session';
    return kept;
  } catch { return ''; }
}

export const initData = telegramInitData() || devIdentity();
/** خلاصه‌ی عیب‌یابی: منبع هویت، طول آن، و سنِ آن (از auth_date) */
export function initDebug(): string {
  let age = '';
  try { const t = Number(new URLSearchParams(initData).get('auth_date')); if (t) age = ` — سن: ${Math.round((Date.now() / 1000 - t) / 60)} دقیقه`; } catch { /* ignore */ }
  return `هویت: ${initSource}${initData.startsWith('dev:') ? ' (آزمایشی)' : ` (${initData.length} نویسه${age})`}`;
}
export const isDev = initData.startsWith('dev:');
export const haptic = () => { try { tg?.HapticFeedback?.impactOccurred('light'); } catch { /* ignore */ } };

/** باز کردن لینک: لینک‌های t.me داخل خود تلگرام، بقیه در مرورگر */
export function openLink(url: string) {
  try {
    if (url.startsWith('https://t.me/') && tg?.openTelegramLink) tg.openTelegramLink(url);
    else if (tg?.openLink) tg.openLink(url);
    else window.open(url, '_blank', 'noopener');
  } catch { window.open(url, '_blank', 'noopener'); }
}

/** پرداخت با استار تلگرام: پنجره‌ی فاکتور داخل تلگرام باز می‌شود؛ نتیجه: paid / cancelled / failed / pending (یا external اگر بیرون از تلگرام باز شد) */
export function openInvoice(url: string): Promise<string> {
  return new Promise((resolve) => {
    try { if (tg?.openInvoice) { tg.openInvoice(url, (st) => resolve(st)); return; } } catch { /* ادامه با لینک */ }
    openLink(url); resolve('external');
  });
}

/** وسط نبرد: اگر کاربر خواست بازی را ببندد، اول تلگرام تأیید می‌گیرد (جلوی بستن اتفاقی و باخت ناخواسته) */
export function setClosingConfirm(on: boolean) {
  try { if (on) tg?.enableClosingConfirmation?.(); else tg?.disableClosingConfirmation?.(); } catch { /* ignore */ }
}
