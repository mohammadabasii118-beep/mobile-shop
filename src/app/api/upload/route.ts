import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/auth';
import { DATA_DIR } from '@/lib/db';
import { optimizeImage } from '@/lib/images';

export const runtime = 'nodejs';
const MAX = 12 * 1024 * 1024;

function detect(b: Buffer): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return '.jpg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return '.webp';
  if (b.subarray(0, 3).toString() === 'GIF') return '.gif';
  if (b.subarray(4, 8).toString() === 'ftyp' && /avif|avis/.test(b.subarray(8, 16).toString())) return '.avif';
  return null;
}

export async function POST(req: Request) {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 });
  }
  const form = await req.formData().catch(() => null);
  const files = form?.getAll('file').filter((f): f is File => f instanceof File) ?? [];
  if (!files.length) return NextResponse.json({ error: 'فایلی ارسال نشد' }, { status: 400 });
  const urls: string[] = [];
  for (const f of files.slice(0, 10)) {
    if (f.size > MAX) return NextResponse.json({ error: `حجم «${f.name}» بیشتر از ۱۲ مگابایت است` }, { status: 413 });
    const buf = Buffer.from(await f.arrayBuffer());
    const ext = detect(buf);
    if (!ext) return NextResponse.json({ error: `«${f.name}» تصویر معتبر نیست (JPG، PNG، WebP، AVIF یا GIF)` }, { status: 415 });
    const d = new Date();
    const dir = path.join(DATA_DIR, 'uploads', String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'));
    fs.mkdirSync(dir, { recursive: true });
    const id = crypto.randomBytes(8).toString('hex');
    let name: string;
    if (ext === '.gif') {
      name = `${id}.gif`;
      fs.writeFileSync(path.join(dir, name), buf);
    } else {
      try {
        name = await optimizeImage(buf, dir, id);
      } catch {
        return NextResponse.json({ error: `«${f.name}» قابل پردازش نیست` }, { status: 415 });
      }
    }
    urls.push(`/uploads/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${name}`);
  }
  return NextResponse.json({ urls });
}
