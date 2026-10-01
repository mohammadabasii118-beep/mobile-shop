import { normalizeDigits } from '../../utils/misc';

export interface ReceiptData {
  amount?: number; // in Toman
  trackingCode?: string;
  date?: string; // as printed (normalised digits)
  occurredAt?: string; // ISO if date/time could be converted
  time?: string;
  bank?: string;
  confidence: number; // 0..1 — extraction completeness, NOT proof of payment
  source: 'ocr' | 'text' | 'none';
}

export interface OcrEngine {
  extractText(image: Buffer): Promise<{ text: string; confidence?: number }>;
}

const BANKS = ['ملی', 'ملت', 'صادرات', 'تجارت', 'سپه', 'کشاورزی', 'مسکن', 'پاسارگاد', 'سامان', 'پارسیان', 'اقتصاد نوین', 'رفاه', 'شهر', 'آینده', 'دی', 'سینا', 'کارآفرین', 'بلو', 'ملل', 'گردشگری', 'مهر ایران', 'قرض‌الحسنه'];

export function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  jy += 1595;
  let days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 0; gm < 13 && gd > sal[gm]; gm++) gd -= sal[gm];
  return [gy, gm, gd];
}

/** Persian-bank receipts are in Jalali and Tehran time (UTC+3:30, no DST since 2022). */
function toIso(date?: string, time?: string): string | undefined {
  if (!date) return undefined;
  const m = date.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (!m) return undefined;
  let [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1700) [y, mo, d] = jalaliToGregorian(y, mo, d);
  const [hh, mm, ss] = (time ?? '00:00:00').split(':').map(Number);
  const utc = Date.UTC(y, mo - 1, d, hh || 0, mm || 0, ss || 0) - (3 * 60 + 30) * 60_000;
  const dt = new Date(utc);
  return Number.isNaN(dt.getTime()) ? undefined : dt.toISOString();
}

export function parseReceiptText(raw: string, source: ReceiptData['source'] = 'text'): ReceiptData {
  const text = normalizeDigits(raw).replace(/[٬،]/g, ',').replace(/‌/g, ' ');
  const out: ReceiptData = { confidence: 0, source };

  // amount
  const lines = text.split(/\n+/);
  let amount: number | undefined;
  for (const line of lines) {
    if (!/مبلغ|amount|ریال|تومان/i.test(line)) continue;
    const m = line.match(/(\d{1,3}(?:,\d{3})+|\d{4,})/);
    if (!m) continue;
    let v = Number(m[1].replace(/,/g, ''));
    if (/ریال/.test(line) && !/تومان/.test(line)) v = Math.round(v / 10);
    amount = v;
    break;
  }
  if (amount) out.amount = amount;

  // tracking code
  const t = text.match(/(?:شماره\s*پیگیری|کد\s*پیگیری|پیگیری|شماره\s*مرجع|مرجع|رهگیری|tracking|ref(?:erence)?)\s*[:：-]?\s*([A-Za-z0-9]{5,24})/i);
  if (t) out.trackingCode = t[1];

  const d = text.match(/(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})/);
  if (d) out.date = d[1];
  const tm = text.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
  if (tm) out.time = tm[1];
  out.occurredAt = toIso(out.date, out.time);
  const bank = BANKS.find((b) => text.includes(b));
  if (bank) out.bank = bank;

  out.confidence = Math.min(1, (out.amount ? 0.4 : 0) + (out.trackingCode ? 0.3 : 0) + (out.date ? 0.15 : 0) + (out.time ? 0.05 : 0) + (out.bank ? 0.1 : 0));
  if (out.confidence === 0) out.source = 'none';
  return out;
}

export async function extractReceipt(engine: OcrEngine | undefined, image?: Buffer, caption?: string): Promise<ReceiptData> {
  if (engine && image) {
    try {
      const { text, confidence } = await engine.extractText(image);
      const r = parseReceiptText(text, 'ocr');
      if (confidence !== undefined) r.confidence = Math.min(r.confidence, Math.max(0, Math.min(1, confidence)));
      return r;
    } catch {
      /* fall through */
    }
  }
  return caption ? parseReceiptText(caption, 'text') : { confidence: 0, source: 'none' };
}

/** Optional Tesseract engine (install `tesseract.js` and set OCR_ENABLED=true). */
export async function createTesseractEngine(): Promise<OcrEngine | undefined> {
  try {
    const mod: any = await import(/* @vite-ignore */ 'tesseract.js' as string);
    return {
      async extractText(image: Buffer) {
        const r = await mod.recognize(image, 'fas+eng');
        return { text: r.data.text as string, confidence: (r.data.confidence as number) / 100 };
      },
    };
  } catch {
    return undefined;
  }
}
