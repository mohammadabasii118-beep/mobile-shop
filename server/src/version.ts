import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** نام فایل جاوااسکریپت ساخته‌شده‌ی فعلی کلاینت (هر بیلد جدید اسم تازه‌ای دارد). */
export function currentBundle(staticDir?: string): string {
  try {
    if (!staticDir) return '';
    const dir = join(staticDir, 'assets');
    if (!existsSync(dir)) return '';
    const files = readdirSync(dir).filter((f) => /^index-.*\.js$/.test(f));
    files.sort((a, b) => statSync(join(dir, b)).mtimeMs - statSync(join(dir, a)).mtimeMs);
    return files[0] ?? '';
  } catch { return ''; }
}

/** شماره‌ی کوتاه نسخه برای پارامتر ?v= (آدرس دکمه‌ی ربات با هر آپدیت عوض می‌شود تا تلگرام صفحه‌ی کش‌شده را نگیرد) */
export function versionTag(staticDir?: string): string {
  const m = /^index-([A-Za-z0-9_-]+)\.js$/.exec(currentBundle(staticDir));
  return m ? m[1] : String(Math.floor(Date.now() / 1000));
}
