import 'dotenv/config';
import { z } from 'zod';

const empty = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const str = () => z.preprocess(empty, z.string().optional());
const bool = (def: boolean) =>
  z.preprocess(empty, z.enum(['true', 'false', '1', '0']).optional()).transform((v) => (v === undefined ? def : v === 'true' || v === '1'));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  BOT_TOKEN: str(),
  ADMIN_TELEGRAM_ID: str(),
  APP_URL: str(),
  PORT: z.preprocess(empty, z.coerce.number().int().default(3000)),
  RECEIPT_DIR: z.preprocess(empty, z.string().default('./data/receipts')),
  LOG_LEVEL: z.preprocess(empty, z.string().default('info')),

  XUI_BASE_URL: str(),
  XUI_USERNAME: str(),
  XUI_PASSWORD: str(),
  XUI_API_TOKEN: str(),
  XUI_SUB_BASE_URL: str(),
  XUI_PUBLIC_HOST: str(),
  VPN_PROVIDER: z.preprocess(empty, z.enum(['xui', 'mock']).default('xui')),

  CARD_TO_CARD_ENABLED: bool(false),
  CARD_HOLDER: str(),
  CARD_NUMBER: str(),
  BANK_NAME: str(),
  PAYMENT_INSTRUCTIONS: str(),

  CRYPTO_ENABLED: bool(false),
  BANK_WEBHOOK_SECRET: str(),
  PANEL_SESSION_SECRET: str(),
  TRUST_PROXY: bool(false),
  OCR_ENABLED: bool(false),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const env = schema.parse(source);
  if (env.NODE_ENV === 'production' && env.VPN_PROVIDER === 'mock') {
    throw new Error('VPN_PROVIDER=mock is forbidden in production');
  }
  return env;
}

let cached: Env | undefined;
export function env(): Env {
  return (cached ??= loadEnv());
}
export function resetEnvCache() {
  cached = undefined;
}
