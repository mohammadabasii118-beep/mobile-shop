import path from 'node:path';
import sharp from 'sharp';

export const IMG_WIDTHS = [480, 960, 1600] as const;
/** بنر هیرو: عرض بزرگ‌تر برای نمایشگر بزرگ و Retina (DESIGN.md §۱۸.۱۲) */
export const BANNER_WIDTHS = [480, 960, 2400] as const;

/** از یک تصویر آپلودی، AVIF و WebP در عرض‌های مختلف می‌سازد؛ نام WebP اصلی را برمی‌گرداند. */
export async function optimizeImage(buf: Buffer, dir: string, id: string, kind: 'product' | 'banner' = 'product'): Promise<string> {
  const base = sharp(buf, { limitInputPixels: 80_000_000 }).rotate();
  const widths = kind === 'banner' ? BANNER_WIDTHS : IMG_WIDTHS;
  const top = widths[widths.length - 1];
  for (const w of widths) {
    const suffix = w === top ? '' : `-${w}`;
    const img = base.clone().resize({ width: w, withoutEnlargement: true });
    await Promise.all([
      img.clone().webp({ quality: 80 }).toFile(path.join(dir, `${id}${suffix}.webp`)),
      img.clone().avif({ quality: 55, effort: 4 }).toFile(path.join(dir, `${id}${suffix}.avif`)),
    ]);
  }
  return `${id}.webp`;
}
