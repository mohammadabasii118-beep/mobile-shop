/**
 * Admin-editable customer texts. Stored in the Setting table under `text.<key>`; the defaults below are the built-in copy.
 * Admin text is PLAIN: it is HTML-escaped on render, `*word*` becomes bold, `{var}` is replaced by an escaped value.
 */
import { prisma } from '../../db/client';
import { ValidationError } from '../../utils/errors';
import { audit } from '../admin/audit';
import { RULE, esc } from '../../bot/format';

export type TextGroup = 'منو و خوش‌آمد' | 'خرید و پرداخت' | 'اعلان‌ها' | 'تحویل سرویس' | 'پشتیبانی و قوانین';
export interface VarSpec { label: string; sample: string; code?: boolean }
export interface TextDef { label: string; group: TextGroup; default: string; vars?: Record<string, VarSpec>; plain?: boolean; max: number; optional?: boolean }

const V = {
  name: { label: 'نام کاربر', sample: 'علی' },
  order: { label: 'شماره سفارش', sample: 'VPN-261001-AB12CD', code: true },
  reason: { label: 'دلیل رد', sample: 'مبلغ اشتباه بود' },
  service: { label: 'نام سرویس', sample: 'اقتصادی ۵۰ گیگ' },
  days: { label: 'روز باقی‌مانده', sample: '۳' },
  date: { label: 'تاریخ انقضا', sample: '۹ آبان ۱۴۰۵' },
} satisfies Record<string, VarSpec>;

export const TEXT_DEFS = {
  welcome: { label: 'پیام خوش‌آمدگویی (/start)', group: 'منو و خوش‌آمد', max: 800, vars: { name: V.name },
    default: `👋 سلام {name}، خوش آمدید!\n${RULE}\n🔒 اینترنت آزاد، سریع و امن\n⚡️ تحویل خودکار سرویس بعد از پرداخت\n🎧 پشتیبانی همراه شما\n${RULE}\nیکی از گزینه‌ها را انتخاب کنید 👇` },
  'btn.buy': { label: 'دکمه‌ی خرید', group: 'منو و خوش‌آمد', max: 30, plain: true, default: '🛒 خرید VPN' },
  'btn.services': { label: 'دکمه‌ی سرویس‌های من', group: 'منو و خوش‌آمد', max: 30, plain: true, default: '📦 سرویس‌های من' },
  'btn.orders': { label: 'دکمه‌ی سفارش‌های من', group: 'منو و خوش‌آمد', max: 30, plain: true, default: '💳 سفارش‌های من' },
  'btn.account': { label: 'دکمه‌ی حساب من', group: 'منو و خوش‌آمد', max: 30, plain: true, default: '👤 حساب من' },
  'btn.coupon': { label: 'دکمه‌ی کد تخفیف', group: 'منو و خوش‌آمد', max: 30, plain: true, default: '🎁 کد تخفیف' },
  'btn.support': { label: 'دکمه‌ی پشتیبانی', group: 'منو و خوش‌آمد', max: 30, plain: true, default: '🎫 پشتیبانی' },
  'btn.rules': { label: 'دکمه‌ی قوانین', group: 'منو و خوش‌آمد', max: 30, plain: true, default: '📜 قوانین' },

  'join.required': { label: 'پیام عضویت اجباری در کانال', group: 'منو و خوش‌آمد', max: 600,
    default: `🔒 *عضویت در کانال*\n${RULE}\nبرای استفاده از ربات، ابتدا در کانال‌های زیر عضو شوید و سپس دکمه «عضو شدم» را بزنید.` },
  'btn.joined': { label: 'دکمه‌ی «عضو شدم»', group: 'منو و خوش‌آمد', max: 30, plain: true, default: '✅ عضو شدم' },
  'join.still': { label: 'پیام وقتی هنوز عضو نشده', group: 'منو و خوش‌آمد', max: 200, plain: true, default: 'هنوز عضو همه‌ی کانال‌ها نشده‌اید' },

  'buy.intro': { label: 'متن بالای صفحه‌ی خرید (اختیاری)', group: 'خرید و پرداخت', max: 500, optional: true, default: '' },
  'buy.prompt': { label: 'جمله‌ی انتخاب پلن', group: 'خرید و پرداخت', max: 200, default: 'یکی را انتخاب کنید 👇' },
  'payment.note': { label: 'توضیح پایین صفحه‌ی پرداخت', group: 'خرید و پرداخت', max: 600, default: '⚠️ مبلغ را *دقیقاً* برابر عدد بالا واریز کنید.\nبعد از پرداخت، دکمه «📤 ارسال رسید» را بزنید.' },
  'receipt.prompt': { label: 'راهنمای ارسال رسید', group: 'خرید و پرداخت', max: 600, default: '📸 عکس رسید را ارسال کنید\nبهتر است کد پیگیری را در کپشن بنویسید.\n\nیا فقط ✍️ کد پیگیری را به‌صورت متن بفرستید.' },
  'coupon.prompt': { label: 'راهنمای کد تخفیف', group: 'خرید و پرداخت', max: 400, default: 'کد تخفیف خود را ارسال کنید.\nکد روی سفارش بعدی شما اعمال می‌شود.' },

  'msg.submitted': { label: 'پیام: رسید ثبت شد', group: 'اعلان‌ها', max: 700, vars: { order: V.order },
    default: `📤 *رسید شما ثبت شد*\n${RULE}\nسفارش {order}\nپرداخت شما در حال بررسی است. نتیجه همین‌جا به شما اعلام می‌شود.` },
  'msg.review': { label: 'پیام: پرداخت در صف بررسی', group: 'اعلان‌ها', max: 700, vars: { order: V.order },
    default: `🔎 *پرداخت در صف بررسی است*\n${RULE}\nسفارش {order}\nپس از تأیید، سرویس به‌صورت خودکار ساخته و ارسال می‌شود. نیازی به اقدام دیگری نیست.` },
  'msg.verified': { label: 'پیام: پرداخت تأیید شد', group: 'اعلان‌ها', max: 700, vars: { order: V.order },
    default: `✅ *پرداخت شما تأیید شد*\n${RULE}\nسفارش {order}\n⏳ سرویس شما در حال آماده‌سازی است...` },
  'msg.rejected': { label: 'پیام: پرداخت رد شد', group: 'اعلان‌ها', max: 800, vars: { order: V.order, reason: V.reason },
    default: `❌ *پرداخت شما تأیید نشد*\n${RULE}\nسفارش {order}\nدلیل: {reason}\n\nاگر پرداخت انجام داده‌اید، رسید درست را دوباره ارسال کنید یا با پشتیبانی در ارتباط باشید.` },
  'msg.expiring': { label: 'پیام: نزدیک انقضا', group: 'اعلان‌ها', max: 700, vars: { service: V.service, days: V.days, date: V.date },
    default: `⏳ *سرویس شما رو به پایان است*\n${RULE}\n📦 {service}\nحدود {days} روز دیگر ({date}) منقضی می‌شود.\nبرای جلوگیری از قطعی، همین حالا تمدید کنید.` },
  'msg.expired': { label: 'پیام: سرویس منقضی شد', group: 'اعلان‌ها', max: 700, vars: { service: V.service },
    default: `⛔ *سرویس شما منقضی شد*\n${RULE}\n📦 {service} منقضی شده است.\nبا تمدید، همان لینک قبلی دوباره فعال می‌شود.` },

  'delivery.sub_hint': { label: 'توضیح زیر لینک اشتراک', group: 'تحویل سرویس', max: 300, optional: true, default: 'این لینک را در برنامه وارد کنید؛ با تمدید یا تغییر سرور خودکار به‌روز می‌شود.' },
  'delivery.tips': { label: 'راهنمای پایان پیام تحویل', group: 'تحویل سرویس', max: 400, optional: true, default: '💡 لینک را در برنامه‌ی V2Ray/Hiddify/Streisand وارد کنید یا QR را اسکن کنید.' },

  'support.intro': { label: 'جمله‌ی بالای پشتیبانی', group: 'پشتیبانی و قوانین', max: 200, default: 'ما کنار شما هستیم' },
  rules: { label: 'متن قوانین', group: 'پشتیبانی و قوانین', max: 1500,
    default: '1️⃣ سرویس‌ها فقط برای استفاده شخصی هستند.\n2️⃣ فروش مجدد یا اشتراک‌گذاری لینک مجاز نیست.\n3️⃣ بازگشت وجه فقط در صورت عدم‌ارائه خدمات امکان‌پذیر است.\n4️⃣ پرداخت را با *مبلغ دقیق* سفارش و به کارت اعلام‌شده انجام دهید.\n5️⃣ ارسال رسید جعلی یا تکراری منجر به مسدود شدن حساب می‌شود.' },
} satisfies Record<string, TextDef>;
export type TextKey = keyof typeof TEXT_DEFS;
export const isTextKey = (k: string): k is TextKey => k in TEXT_DEFS;
const defs = (k: TextKey): TextDef => TEXT_DEFS[k];
export const textDef = defs;

const PREFIX = 'text.';
let cache: { at: number; map: Map<string, string> } | undefined;
const TTL = 5_000;
export const clearTextCache = () => { cache = undefined; };

async function stored(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < TTL) return cache.map;
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: PREFIX } } });
  cache = { at: Date.now(), map: new Map(rows.map((r) => [r.key.slice(PREFIX.length), r.value])) };
  return cache.map;
}

/** Admin text → Telegram HTML: escape, `*bold*`, then `{var}` (values escaped; `code` vars shown as tap-to-copy). */
export function renderHtml(template: string, def: TextDef, vars: Record<string, string> = {}): string {
  let out = esc(template).replace(/\*([^*\n]+)\*/g, '<b>$1</b>');
  out = out.replace(/\{(\w+)\}/g, (m, name: string) => {
    const spec = def.vars?.[name];
    if (!spec) return m;
    const v = esc(vars[name] ?? '');
    return spec.code ? `<code>${v}</code>` : v;
  });
  return out;
}

export interface Texts {
  /** HTML-safe rendering of an editable text */
  html(key: TextKey, vars?: Record<string, string>): string;
  /** raw text (button labels etc.) */
  plain(key: TextKey): string;
}

export async function loadTexts(): Promise<Texts> {
  const map = await stored();
  const raw = (k: TextKey) => (map.has(k) ? map.get(k)! : defs(k).default);
  return {
    html: (k, vars) => renderHtml(raw(k), defs(k), vars),
    plain: (k) => raw(k),
  };
}

export interface TextItem { key: TextKey; label: string; group: TextGroup; value: string; default: string; isDefault: boolean; vars: { name: string; label: string; sample: string }[]; max: number; plain: boolean; optional: boolean }
export async function listTexts(): Promise<TextItem[]> {
  const map = await stored();
  return (Object.keys(TEXT_DEFS) as TextKey[]).map((key) => {
    const d = defs(key);
    return { key, label: d.label, group: d.group, value: map.has(key) ? map.get(key)! : d.default, default: d.default, isDefault: !map.has(key), vars: Object.entries(d.vars ?? {}).map(([name, s]) => ({ name, label: s.label, sample: s.sample })), max: d.max, plain: !!d.plain, optional: !!d.optional };
  });
}

/** Rendered sample (for previews). */
export function previewText(key: TextKey, value: string): string {
  const d = defs(key);
  return d.plain ? value : renderHtml(value, d, Object.fromEntries(Object.entries(d.vars ?? {}).map(([n, s]) => [n, s.sample])));
}

export function validateText(key: TextKey, raw: string): string {
  const d = defs(key);
  const value = raw.replace(/\r\n/g, '\n').trim();
  if (!value && !d.optional) throw new ValidationError('این متن نمی‌تواند خالی باشد');
  if (value.length > d.max) throw new ValidationError(`حداکثر ${d.max} حرف مجاز است (الان ${value.length})`);
  if (d.plain && /\n/.test(value)) throw new ValidationError('برچسب دکمه باید یک خط باشد');
  for (const m of value.matchAll(/\{(\w+)\}/g)) {
    if (!d.vars?.[m[1]]) throw new ValidationError(`متغیر {${m[1]}} در این متن مجاز نیست${d.vars ? ` (مجاز: ${Object.keys(d.vars).map((n) => `{${n}}`).join(' ')})` : ''}`);
  }
  if (value.includes('\0')) throw new ValidationError('کاراکتر نامعتبر');
  return value;
}

export async function setText(actor: string, key: TextKey, raw: string) {
  const value = validateText(key, raw);
  await prisma.setting.upsert({ where: { key: PREFIX + key }, create: { key: PREFIX + key, value }, update: { value } });
  clearTextCache();
  await audit({ actor, action: 'text.update', target: 'Text', targetId: key, metadata: { length: value.length } });
}

export async function resetText(actor: string, key: TextKey) {
  await prisma.setting.deleteMany({ where: { key: PREFIX + key } });
  clearTextCache();
  await audit({ actor, action: 'text.reset', target: 'Text', targetId: key });
}
