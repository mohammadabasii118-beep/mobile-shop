import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { ingestPost } from '@/lib/channel/ingest';

export const runtime = 'nodejs';
const MAX_BODY = 14 * 1024 * 1024;

/** مقایسه‌ی زمان‌ثابت تا طول و محتوای رمز از زمان پاسخ لو نرود */
function safeEqual(a: string, b: string) {
  const ha = crypto.createHash('sha256').update(a).digest(), hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * ورودی امن برای رباتی که خودش کانال را می‌خواند (مثلاً پنل شبکه‌های اجتماعی) و هر پست را به فروشگاه می‌فرستد.
 * هدر `x-channel-secret` باید برابر CHANNEL_INGEST_SECRET باشد؛ اگر آن متغیر تنظیم نشده باشد، این مسیر خاموش است.
 * بدنه: { id: string|number, text: string, date?: ISO, group_id?: string, image_base64?: string }
 */
export async function POST(req: Request) {
  const secret = process.env.CHANNEL_INGEST_SECRET || '';
  if (secret.length < 16) return NextResponse.json({ error: 'غیرفعال' }, { status: 404 });
  if (!safeEqual(req.headers.get('x-channel-secret') ?? '', secret)) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 });
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return NextResponse.json({ error: 'حجم زیاد است' }, { status: 413 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || (typeof b.id !== 'string' && typeof b.id !== 'number') || typeof b.text !== 'string') return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 });
  const date = typeof b.date === 'string' && !Number.isNaN(Date.parse(b.date)) ? new Date(b.date) : new Date();
  const image = typeof b.image_base64 === 'string' && b.image_base64.length < MAX_BODY ? Buffer.from(b.image_base64, 'base64') : null;
  const r = await ingestPost({
    key: `ext:${String(b.id).slice(0, 80)}`,
    groupId: typeof b.group_id === 'string' ? b.group_id.slice(0, 80) : null,
    text: b.text.slice(0, 12_000),
    date,
    image,
    edited: b.edited === true,
  });
  return NextResponse.json(r);
}
