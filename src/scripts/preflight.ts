/** Production readiness checklist: `npm run preflight`. Exit 1 if any FAIL. */
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from '../config/env';

type Level = 'PASS' | 'WARN' | 'FAIL';
export interface Check { level: Level; name: string; detail: string }

const root0 = (e: { TELEGRAM_API_ROOT?: string }) => e.TELEGRAM_API_ROOT ?? 'api.telegram.org';

export async function runPreflight(source: NodeJS.ProcessEnv = process.env, opts: { network?: boolean } = {}): Promise<Check[]> {
  const out: Check[] = [];
  const add = (level: Level, name: string, detail = '') => out.push({ level, name, detail });
  let env;
  try { env = loadEnv(source); } catch (e: any) { add('FAIL', 'env parse', String(e?.message).slice(0, 200)); return out; }

  add(env.NODE_ENV === 'production' ? 'PASS' : 'WARN', 'NODE_ENV', env.NODE_ENV);
  add(env.BOT_TOKEN && /^\d+:[\w-]{30,}$/.test(env.BOT_TOKEN) ? 'PASS' : 'FAIL', 'BOT_TOKEN', env.BOT_TOKEN ? 'format ok' : 'missing / bad format');
  add(env.ADMIN_TELEGRAM_ID && /^\d+$/.test(env.ADMIN_TELEGRAM_ID) ? 'PASS' : 'FAIL', 'ADMIN_TELEGRAM_ID', 'numeric Telegram user id of the SUPER_ADMIN');
  add(/^postgres(ql)?:\/\//.test(env.DATABASE_URL) && !env.DATABASE_URL.includes('CHANGE_ME') ? 'PASS' : 'FAIL', 'DATABASE_URL', 'must be a real postgres url');

  // X-UI
  add(env.VPN_PROVIDER === 'xui' ? 'PASS' : 'FAIL', 'VPN_PROVIDER', env.VPN_PROVIDER);
  add(env.XUI_BASE_URL && /^https?:\/\//.test(env.XUI_BASE_URL) ? 'PASS' : 'FAIL', 'XUI_BASE_URL', 'include the panel web base path, e.g. https://host:2053/<webBasePath>');
  if (env.XUI_BASE_URL?.startsWith('http://') && !/(localhost|127\.0\.0\.1)/.test(env.XUI_BASE_URL)) add('WARN', 'XUI_BASE_URL uses http://', 'credentials travel in clear text; prefer https or a private network');
  if (env.XUI_TLS_INSECURE) add('WARN', 'XUI_TLS_INSECURE=true', 'panel certificate is NOT verified; use a valid certificate/domain when possible');
  add(env.XUI_API_TOKEN || (env.XUI_USERNAME && env.XUI_PASSWORD) ? 'PASS' : 'FAIL', 'X-UI credentials', env.XUI_API_TOKEN ? 'api token' : 'username/password');
  add(env.XUI_PUBLIC_HOST || env.XUI_BASE_URL ? 'PASS' : 'WARN', 'XUI_PUBLIC_HOST', env.XUI_PUBLIC_HOST ?? 'falls back to the panel hostname — set it if clients connect through a different domain/IP');
  add(env.XUI_SUB_BASE_URL ? 'PASS' : 'WARN', 'XUI_SUB_BASE_URL', env.XUI_SUB_BASE_URL ? 'subscription links enabled' : 'unset → no subscription link shown to users');

  // payments
  if (env.CARD_TO_CARD_ENABLED) {
    const n = (env.CARD_NUMBER ?? '').replace(/\D/g, '');
    add(n.length === 16 ? 'PASS' : 'FAIL', 'CARD_NUMBER', n.length === 16 ? 'ok' : 'card-to-card enabled but no valid 16-digit card number');
    add(env.CARD_HOLDER ? 'PASS' : 'WARN', 'CARD_HOLDER');
    add(env.BANK_NAME ? 'PASS' : 'WARN', 'BANK_NAME');
  } else add('WARN', 'CARD_TO_CARD_ENABLED=false', 'users cannot buy');
  add(env.BANK_WEBHOOK_SECRET && env.BANK_WEBHOOK_SECRET.length >= 24 ? 'PASS' : 'WARN', 'BANK_WEBHOOK_SECRET', 'without a bank-transaction feed nothing is auto-approved (all payments go to manual review)');
  add(env.APP_URL?.startsWith('https://') ? 'PASS' : 'WARN', 'APP_URL (admin panel link)', env.APP_URL ? (env.APP_URL.startsWith('https://') ? env.APP_URL : 'not https — panel login cookie will not be marked Secure; put a TLS proxy in front') : 'unset → /panel links point to localhost');
  add(env.PANEL_SESSION_SECRET || env.BOT_TOKEN ? 'PASS' : 'FAIL', 'PANEL_SESSION_SECRET', env.PANEL_SESSION_SECRET ? 'set' : 'derived from BOT_TOKEN (set an explicit secret for rotation)');
  add(!env.CRYPTO_ENABLED ? 'PASS' : 'WARN', 'CRYPTO_ENABLED', 'crypto stays disabled without a chain verifier');

  try {
    const dir = path.resolve(env.RECEIPT_DIR);
    await mkdir(dir, { recursive: true });
    const f = path.join(dir, '.preflight');
    await writeFile(f, 'x'); await unlink(f);
    add('PASS', 'RECEIPT_DIR writable', dir);
  } catch (e: any) { add('FAIL', 'RECEIPT_DIR writable', String(e?.message)); }

  if (opts.network !== false) {
    try {
      const { PrismaClient } = await import('@prisma/client');
      const p = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
      await p.$queryRaw`SELECT 1`;
      const r = await p.$queryRaw<{ n: bigint }[]>`SELECT count(*) n FROM _prisma_migrations WHERE finished_at IS NOT NULL`;
      await p.$disconnect();
      add(Number(r[0].n) >= 3 ? 'PASS' : 'FAIL', 'database + migrations', `${r[0].n} migration(s) applied (run: npx prisma migrate deploy)`);
    } catch (e: any) { add('FAIL', 'database + migrations', String(e?.message).split('\n').at(-1)?.slice(0, 160) ?? 'error'); }
    if (env.BOT_TOKEN) {
      try {
        const { telegramGet } = await import('../bot/telegramNet');
        const root = (env.TELEGRAM_API_ROOT ?? 'https://api.telegram.org').replace(/\/+$/, '');
        const res = await telegramGet(`${root}/bot${env.BOT_TOKEN}/getMe`, 10_000);
        const r = JSON.parse(res.body.toString('utf8')) as any;
        add(r.ok ? 'PASS' : 'FAIL', 'Telegram getMe', r.ok ? `@${r.result.username}${env.TELEGRAM_PROXY_URL ? ' (via proxy)' : env.TELEGRAM_API_ROOT ? ' (via API root)' : ''}` : 'token rejected');
      } catch (e: any) { add('FAIL', 'Telegram getMe', `${root0(env)} unreachable from this host (${String(e?.code ?? e?.message).slice(0, 60)}). Set TELEGRAM_PROXY_URL or TELEGRAM_API_ROOT, or host the bot outside the blocked network`); }
    }
    if (env.XUI_BASE_URL) {
      try {
        const { XuiClient } = await import('../providers/vpn/xui/client');
        const list = await new XuiClient({ baseUrl: env.XUI_BASE_URL, username: env.XUI_USERNAME, password: env.XUI_PASSWORD, apiToken: env.XUI_API_TOKEN, fetchImpl: (await import('../providers/vpn/xui/net')).xuiFetch() }).listInbounds();
        add('PASS', 'X-UI auth + inbounds', `${list.length} inbound(s)`);
      } catch (e: any) { add('FAIL', 'X-UI auth + inbounds', String(e?.message)); }
    }
  }
  return out;
}

async function main() {
  const checks = await runPreflight();
  for (const c of checks) console.log(`${c.level === 'PASS' ? '✅' : c.level === 'WARN' ? '⚠️ ' : '❌'} ${c.level.padEnd(4)} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  const fails = checks.filter((c) => c.level === 'FAIL').length;
  console.log(fails ? `\n${fails} blocking problem(s).` : '\nReady (review WARN items).');
  process.exit(fails ? 1 : 0);
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
