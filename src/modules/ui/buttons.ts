import { z } from 'zod';
import { getSetting, setSetting } from '../settings/service';
import { audit } from '../admin/audit';
import { ValidationError } from '../../utils/errors';

export type BtnStyle = 'primary' | 'success' | 'danger';
export interface BtnLook { style?: BtnStyle; emoji?: string }

/** Buttons whose look can be edited. `key` matches the callback data exactly or as a prefix ("sv:renew" also matches "sv:renew:123"). */
export const UI_BUTTONS: { key: string; label: string; group: string; style?: BtnStyle }[] = [
  { key: 'menu:buy', label: 'خرید', group: 'منوی اصلی', style: 'success' },
  { key: 'menu:services', label: 'سرویس‌های من', group: 'منوی اصلی' },
  { key: 'menu:orders', label: 'سفارش‌های من', group: 'منوی اصلی' },
  { key: 'menu:account', label: 'حساب من', group: 'منوی اصلی' },
  { key: 'menu:coupon', label: 'کد تخفیف', group: 'منوی اصلی' },
  { key: 'menu:support', label: 'پشتیبانی', group: 'منوی اصلی' },
  { key: 'menu:rules', label: 'قوانین', group: 'منوی اصلی' },
  { key: 'menu:partner', label: 'همکاری', group: 'منوی اصلی' },
  { key: 'buy', label: 'دکمه‌ی هر محصول (لیست خرید)', group: 'خرید', style: 'success' },
  { key: 'bc', label: 'دکمه‌ی دسته‌بندی‌ها (لیست خرید)', group: 'خرید', style: 'primary' },
  { key: 'bo', label: 'پرداخت کارت‌به‌کارت', group: 'خرید', style: 'success' },
  { key: 'adm:dash', label: 'داشبورد', group: 'پنل مدیریت (ربات)', style: 'primary' },
  { key: 'adm:g:fin', label: 'فروش و مالی', group: 'پنل مدیریت (ربات)' },
  { key: 'adm:g:cat', label: 'محصولات و منوی خرید', group: 'پنل مدیریت (ربات)' },
  { key: 'adm:g:srv', label: 'سرویس‌ها و سرورها', group: 'پنل مدیریت (ربات)' },
  { key: 'adm:g:set', label: 'تنظیمات و ابزارها', group: 'پنل مدیریت (ربات)' },
  { key: 'adm:tickets', label: 'پشتیبانی', group: 'پنل مدیریت (ربات)' },
  { key: 'bm:h', label: 'پیام همگانی', group: 'پنل مدیریت (ربات)' },
  { key: 'adm:web', label: 'ورود به پنل وب', group: 'پنل مدیریت (ربات)' },
  { key: 'adm:home', label: 'بازگشت به پنل مدیریت', group: 'پنل مدیریت (ربات)' },
  { key: 'adm:products', label: 'مدیریت محصولات', group: 'پنل مدیریت (ربات)' },
  { key: 'pr:new', label: 'محصول جدید', group: 'پنل مدیریت (ربات)', style: 'success' },
  { key: 'pr:d', label: 'حذف محصول', group: 'پنل مدیریت (ربات)', style: 'danger' },
  { key: 'menu:main', label: 'بازگشت به منوی اصلی', group: 'ناوبری' },
  { key: 'sv:renew', label: 'تمدید سرویس', group: 'سرویس', style: 'success' },
  { key: 'sv:del', label: 'حذف سرویس', group: 'سرویس', style: 'danger' },
];

const lookSchema = z.object({ style: z.enum(['primary', 'success', 'danger']).optional(), emoji: z.string().regex(/^\d{5,25}$/, 'شناسه‌ی ایموجی پرمیوم فقط عدد است').optional() });
const SETTING = 'ui.buttons' as any;

let cache: Record<string, BtnLook> = {};
let loadedAt = 0;

function parse(raw: string): Record<string, BtnLook> {
  try {
    const o = JSON.parse(raw || '{}');
    const out: Record<string, BtnLook> = {};
    for (const [k, v] of Object.entries(o)) { const r = lookSchema.safeParse(v); if (r.success) out[k] = r.data; }
    return out;
  } catch { return {}; }
}

export async function loadButtonLooks(force = false) {
  if (!force && Date.now() - loadedAt < 20_000) return;
  loadedAt = Date.now();
  try { cache = parse(await getSetting(SETTING)); } catch { /* keep the previous values */ }
}

/** Sync lookup used when keyboards are built: admin override first, then the built-in default. */
export function lookFor(data?: string): BtnLook {
  if (!data) return {};
  const hit = UI_BUTTONS.find((b) => data === b.key || data.startsWith(b.key + ':'));
  if (!hit) return {};
  const o = cache[hit.key];
  if (o) return { style: o.style, emoji: o.emoji };
  return { style: hit.style };
}

export async function listButtonLooks() {
  await loadButtonLooks(true);
  return UI_BUTTONS.map((b) => ({ ...b, style: cache[b.key] ? (cache[b.key].style ?? null) : (b.style ?? null), emoji: cache[b.key]?.emoji ?? null, isDefault: !cache[b.key] }));
}

export async function setButtonLook(actor: string, key: string, input: { style?: string | null; emoji?: string | null }) {
  if (!UI_BUTTONS.some((b) => b.key === key)) throw new ValidationError('دکمه‌ی نامعتبر');
  const cur = parse(await getSetting(SETTING));
  const look = lookSchema.safeParse({ style: input.style || undefined, emoji: (input.emoji ?? '').trim() || undefined });
  if (!look.success) throw new ValidationError(look.error.issues[0]?.message ?? 'مقدار نامعتبر');
  cur[key] = look.data; // explicit entry (even empty) overrides the default
  await setSetting(SETTING, JSON.stringify(cur));
  await audit({ actor, action: 'ui.button', target: 'Setting', targetId: key, metadata: look.data });
  await loadButtonLooks(true);
}

export async function resetButtonLook(actor: string, key: string) {
  const cur = parse(await getSetting(SETTING));
  delete cur[key];
  await setSetting(SETTING, JSON.stringify(cur));
  await audit({ actor, action: 'ui.button.reset', target: 'Setting', targetId: key });
  await loadButtonLooks(true);
}
