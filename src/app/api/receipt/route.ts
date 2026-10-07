import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { DATA_DIR, get } from '@/lib/db';
import { DRIVERS } from '@/lib/payment-drivers';
import { getMethod, orderPayCode } from '@/lib/payment-methods';

export const runtime = 'nodejs';
const MAX = 6 * 1024 * 1024;
const RECEIPT_DIR = path.join(DATA_DIR, 'receipts');

const hits = new Map<string, { n: number; t: number }>();
function allowed(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 10 * 60_000) { hits.set(ip, { n: 1, t: now }); return true; }
  return ++h.n <= 8;
}

function isImage(b: Buffer): boolean {
  if (b.length < 12) return false;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true;
  return b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP';
}

/** آپلود عکس رسید کارت‌به‌کارت توسط مشتری (عمومی، فقط برای سفارش منتظر پرداخت از نوع دستی) */
export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
  if (!allowed(ip)) return NextResponse.json({ error: 'تعداد درخواست زیاد است؛ چند دقیقه بعد دوباره امتحان کنید' }, { status: 429 });
  const form = await req.formData().catch(() => null);
  const number = String(form?.get('number') ?? '');
  const f = form?.get('file');
  if (!(f instanceof File)) return NextResponse.json({ error: 'فایلی ارسال نشد' }, { status: 400 });
  const o = get<{ payment_status: string; pay_code: string | null; payment_method: string; created_at: string }>('SELECT payment_status, pay_code, payment_method, created_at FROM orders WHERE number = ?', number);
  const m = o && getMethod(orderPayCode(o));
  if (!o || o.payment_status === 'paid' || !m || DRIVERS[m.driver]?.kind !== 'manual') return NextResponse.json({ error: 'این سفارش در انتظار پرداخت دستی نیست' }, { status: 400 });
  if (f.size > MAX) return NextResponse.json({ error: 'حجم عکس بیشتر از ۶ مگابایت است' }, { status: 413 });
  const buf = Buffer.from(await f.arrayBuffer());
  if (!isImage(buf)) return NextResponse.json({ error: 'فقط عکس (JPG، PNG یا WebP) قابل قبول است' }, { status: 415 });
  try {
    fs.mkdirSync(RECEIPT_DIR, { recursive: true });
    const file = `${crypto.randomBytes(8).toString('hex')}.webp`;
    await sharp(buf, { limitInputPixels: 80_000_000 }).rotate().resize({ width: 1400, height: 1800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(RECEIPT_DIR, file));
    return NextResponse.json({ file });
  } catch {
    return NextResponse.json({ error: 'عکس قابل پردازش نیست' }, { status: 415 });
  }
}
