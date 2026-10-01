import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
export const hmacSha256 = (secret: string, data: string | Buffer) => createHmac('sha256', secret).update(data).digest('hex');
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
export const randomId = (bytes = 8) => randomBytes(bytes).toString('hex');

export const GB = 1024n * 1024n * 1024n;
export const gbToBytes = (gb: number): bigint => BigInt(Math.round(gb)) * GB;
export const bytesToGB = (b: bigint | number): number => Number(b) / Number(GB);
export const DAY_MS = 86_400_000;
export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);

const FA = '۰۱۲۳۴۵۶۷۸۹';
const AR = '٠١٢٣٤٥٦٧٨٩';
/** Normalise Persian/Arabic digits to ASCII. */
export function normalizeDigits(s: string): string {
  return s.replace(/[۰-۹]/g, (c) => String(FA.indexOf(c))).replace(/[٠-٩]/g, (c) => String(AR.indexOf(c)));
}
export const toPersianDigits = (s: string | number) => String(s).replace(/\d/g, (d) => FA[Number(d)]);
export const formatMoney = (n: number, currency = 'IRT') =>
  `${toPersianDigits(n.toLocaleString('en-US'))} ${currency === 'IRT' ? 'تومان' : currency}`;
export function formatBytes(b: bigint | number): string {
  const n = Number(b);
  if (n >= Number(GB)) return `${(n / Number(GB)).toFixed(2)} GB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
