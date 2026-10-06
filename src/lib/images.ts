import path from 'node:path';
import sharp from 'sharp';

export const IMG_WIDTHS = [480, 960, 1600] as const;
const MAX_W = IMG_WIDTHS[IMG_WIDTHS.length - 1];

/** از یک تصویر آپلودی، AVIF و WebP در عرض‌های مختلف می‌سازد؛ نام WebP اصلی را برمی‌گرداند. */
export async function optimizeImage(buf: Buffer, dir: string, id: string): Promise<string> {
  const base = sharp(buf, { limitInputPixels: 80_000_000 }).rotate();
  for (const w of IMG_WIDTHS) {
    const suffix = w === MAX_W ? '' : `-${w}`;
    const img = base.clone().resize({ width: w, withoutEnlargement: true });
    await Promise.all([
      img.clone().webp({ quality: 80 }).toFile(path.join(dir, `${id}${suffix}.webp`)),
      img.clone().avif({ quality: 55, effort: 4 }).toFile(path.join(dir, `${id}${suffix}.avif`)),
    ]);
  }
  return `${id}.webp`;
}
