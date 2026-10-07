import { all, get } from './db';
import { DRIVERS } from './payment-drivers';
import { onlineGatewayEnabled } from './payments';

export type PayMethod = {
  id: number; code: string; driver: string; title: string; description: string; enabled: number; sort: number;
  min_amount: number; max_amount: number; config: string; builtin: number;
};
export type PayMethodView = Omit<PayMethod, 'config'> & { cfg: Record<string, string> };

export function parseCfg(raw: string): Record<string, string> {
  try {
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v ?? '')])) : {};
  } catch { return {}; }
}
const view = (m: PayMethod): PayMethodView => { const { config, ...rest } = m; return { ...rest, cfg: parseCfg(config) }; };

export function listMethods(): PayMethodView[] {
  return all<PayMethod>('SELECT * FROM payment_methods ORDER BY sort, id').map(view);
}
export function getMethod(code: string): PayMethodView | null {
  const m = get<PayMethod>('SELECT * FROM payment_methods WHERE code = ?', code);
  return m ? view(m) : null;
}

/** آیا این روش اکنون می‌تواند در تسویه نمایش داده شود (بدون توجه به مبلغ)؟ */
export function isUsable(m: PayMethodView): boolean {
  const d = DRIVERS[m.driver];
  if (!m.enabled || !d || !d.implemented) return false;
  if (m.driver === 'test' && !onlineGatewayEnabled()) return false;
  if (m.driver === 'card' && !/^\d{16}$/.test((m.cfg.card_number ?? '').replace(/\D/g, ''))) return false;
  return true;
}
export const inRange = (m: PayMethodView, total: number) => total >= m.min_amount && (!m.max_amount || total <= m.max_amount);

/** روش‌های قابل‌انتخاب در تسویه. با total مشخص، بازه‌ی مبلغ هم اعمال می‌شود. */
export function checkoutMethods(total?: number): PayMethodView[] {
  return listMethods().filter((m) => isUsable(m) && (total === undefined || inRange(m, total)));
}

/** برچسب نمایشی برای کد روش (یا نوع قدیمی cod/online) */
export function payLabels(): Record<string, string> {
  const map: Record<string, string> = { cod: 'پرداخت در محل', online: 'پرداخت آنلاین' };
  for (const m of listMethods()) map[m.code] = m.title;
  return map;
}
export const orderPayCode = (o: { pay_code: string | null; payment_method: string }) => o.pay_code ?? o.payment_method;
