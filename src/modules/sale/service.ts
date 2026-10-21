import { getSetting } from '../settings/service';

export interface Sale { active: boolean; percent: number; endsAt: Date | null; title: string }

/** "YYYY-MM-DD HH:mm" in Tehran time (UTC+03:30, no DST) -> Date. Returns null when empty/invalid. */
export function parseTehranTime(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+03:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The store-wide sale: a percentage off every plan until `sale.endsAt` (Tehran time). Empty end = until switched off. */
export async function getSale(now = new Date()): Promise<Sale> {
  const percent = Math.floor(Number(await getSetting('sale.percent')));
  const rawEnd = (await getSetting('sale.endsAt')).trim();
  const endsAt = rawEnd ? parseTehranTime(rawEnd) : null;
  const title = (await getSetting('sale.title')).trim() || '🔥 تخفیف ویژه';
  const valid = Number.isFinite(percent) && percent > 0 && percent <= 90;
  const expired = rawEnd !== '' && (!endsAt || endsAt.getTime() <= now.getTime()); // an unreadable end date switches the sale off rather than running it forever
  return { active: valid && !expired, percent: valid ? percent : 0, endsAt, title };
}

export const saleAmount = (sale: Sale, price: number) => (sale.active ? Math.floor((price * sale.percent) / 100) : 0);
