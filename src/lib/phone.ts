'use client';

/** گوشی ذخیره‌شده‌ی مشتری: localStorage (برای پیش‌انتخاب) + کوکی (تا سرور فیلتر خودکار را اعمال کند). DESIGN.md §۱۸.۱۵ */
export const PHONE_COOKIE = 'vt_model';

export function savePhone(brand: string, model: string) {
  try { localStorage.setItem('vt_phone', JSON.stringify({ brand, model })); } catch { /* noop */ }
  try { document.cookie = `${PHONE_COOKIE}=${encodeURIComponent(model)}; path=/; max-age=31536000; samesite=lax`; } catch { /* noop */ }
}

export function clearPhone() {
  try { localStorage.removeItem('vt_phone'); } catch { /* noop */ }
  try { document.cookie = `${PHONE_COOKIE}=; path=/; max-age=0; samesite=lax`; } catch { /* noop */ }
}

export function hasPhoneCookie(): boolean {
  try { return document.cookie.split('; ').some((c) => c.startsWith(`${PHONE_COOKIE}=`) && c.length > PHONE_COOKIE.length + 1); } catch { return false; }
}
