import { prisma } from '../../db/client';
import { env } from '../../config/env';

/** Defaults are SAFE: receipt-only auto approval is off, auto verification needs a real provider. */
export const SETTING_DEFAULTS = {
  'card.enabled': () => String(env().CARD_TO_CARD_ENABLED),
  'card.holder': () => env().CARD_HOLDER ?? '',
  'card.number': () => env().CARD_NUMBER ?? '',
  'card.bank': () => env().BANK_NAME ?? '',
  'card.instructions': () => env().PAYMENT_INSTRUCTIONS ?? '',
  'crypto.enabled': () => String(env().CRYPTO_ENABLED),
  'verification.mode': () => 'AUTO_VERIFICATION', // MANUAL_REVIEW | AUTO_VERIFICATION
  'verification.provider': () => 'ledger', // ledger | none
  'verification.allowReceiptOnlyAutoApprove': () => 'false',
  'verification.timeWindowMinutes': () => '1440',
  'risk.mediumAt': () => '30',
  'risk.highAt': () => '60',
  'risk.highAction': () => 'MANUAL_REVIEW', // MANUAL_REVIEW | REJECT
  'risk.ocrMinConfidence': () => '0.6',
  'risk.maxSubmissions24h': () => '5',
  'provisioning.maxRetries': () => '5',
  'provisioning.backoffSeconds': () => '60,300,900,1800,3600',
  'provisioning.processingTimeoutSeconds': () => '300',
  'notify.expiryDays': () => '3,1',
  'xui.defaultInboundId': () => '',
  'orders.expireMinutes': () => '1440',
} as const;
export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSetting(key: SettingKey): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row ? row.value : SETTING_DEFAULTS[key]();
}
export async function getBool(key: SettingKey) {
  return (await getSetting(key)) === 'true';
}
export async function getNumber(key: SettingKey) {
  return Number(await getSetting(key));
}
export async function getNumberList(key: SettingKey) {
  return (await getSetting(key))
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}
export async function setSetting(key: SettingKey, value: string) {
  if (!(key in SETTING_DEFAULTS)) throw new Error(`Unknown setting ${key}`);
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}
export async function allSettings(): Promise<Record<SettingKey, string>> {
  const rows = await prisma.setting.findMany();
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as Record<SettingKey, string>;
  for (const k of Object.keys(SETTING_DEFAULTS) as SettingKey[]) out[k] = m.get(k) ?? SETTING_DEFAULTS[k]();
  return out;
}
