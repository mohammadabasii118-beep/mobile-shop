/**
 * Live X-UI / 3x-ui connection test. Uses a DISPOSABLE client (email tgtest_*) that is always deleted.
 *   npm run xui:check -- --inbound <id>
 * Reports each capability as PASS/FAIL with the panel's own error message (never secrets).
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { XuiClient } from '../providers/vpn/xui/client';
import { XuiVpnProvider } from '../providers/vpn/xui/provider';
import { RawInbound, parseStream } from '../providers/vpn/xui/link';
import { GB } from '../utils/misc';

export interface CheckStep { name: string; ok: boolean; detail: string }

export async function runXuiCheck(client: XuiClient, provider: XuiVpnProvider, inboundId: number | undefined, log: (s: CheckStep) => void = () => undefined, fetchImpl: typeof fetch = fetch): Promise<CheckStep[]> {
  const steps: CheckStep[] = [];
  const rec = (name: string, ok: boolean, detail: string) => { const s = { name, ok, detail }; steps.push(s); log(s); return ok; };
  const guard = async (name: string, fn: () => Promise<string>) => {
    try { return rec(name, true, await fn()); } catch (e: any) { return rec(name, false, String(e?.message ?? e).slice(0, 300)); }
  };

  let inbounds: RawInbound[] = [];
  if (!(await guard('authentication + list inbounds', async () => {
    inbounds = await client.listInbounds();
    return `ok, ${inbounds.length} inbound(s): ` + inbounds.map((i) => `#${i.id} ${i.protocol}:${i.port} ${i.enable ? 'on' : 'OFF'} ${parseStream(i).network ?? '-'}/${parseStream(i).security ?? '-'}`).join('; ');
  }))) return steps;

  if (inboundId === undefined) { rec('inbound lookup', false, 'pass --inbound <id> (or XUI_CHECK_INBOUND) to test client operations'); return steps; }
  let proto: 'VLESS' | 'VMESS' | 'TROJAN' | 'SHADOWSOCKS' = 'VLESS';
  if (!(await guard('inbound lookup', async () => {
    const ib = await provider.getInbound(inboundId);
    if (!ib) throw new Error(`inbound ${inboundId} not found`);
    if (!ib.enable) throw new Error(`inbound ${inboundId} is disabled`);
    const map: Record<string, typeof proto> = { vless: 'VLESS', vmess: 'VMESS', trojan: 'TROJAN', shadowsocks: 'SHADOWSOCKS' };
    if (!map[ib.protocol]) throw new Error(`unsupported protocol ${ib.protocol}`);
    proto = map[ib.protocol];
    return `inbound ${ib.id}: ${ib.protocol}, port ${ib.port}, enabled`;
  }))) return steps;

  const email = `tgtest_${randomBytes(4).toString('hex')}`;
  const credential = proto === 'VLESS' || proto === 'VMESS' ? randomUUID() : randomBytes(18).toString('base64url');
  const ref = { inboundId, email, credential, protocol: proto };
  const expiry = new Date(Date.now() + 86_400_000);
  try {
    if (!(await guard('create client', async () => {
      const r = await provider.createService({ ...ref, subId: randomBytes(8).toString('hex'), telegramId: '0', trafficLimitBytes: 1n * GB, expiresAt: expiry });
      return `created ${email} (adopted=${r.adopted})`;
    }))) return steps;
    await guard('verify client exists', async () => {
      const s = await provider.getServiceStatus(ref);
      if (!s?.exists) throw new Error('client not found after creation');
      return `found, enabled=${s.enabled}`;
    });
    await guard('traffic (getClientTraffics)', async () => {
      const t = await provider.getTraffic(ref);
      if (!t) throw new Error('traffic endpoint returned nothing for the client');
      if (t.total !== 1n * GB) throw new Error(`total=${t.total}, expected ${1n * GB} bytes (unit mismatch?)`);
      return `up=${t.up} down=${t.down} total=${t.total} (1 GB = bytes confirmed)`;
    });
    await guard('expiry stored', async () => {
      const s = await provider.getServiceStatus(ref);
      if (s?.expiresAt?.getTime() !== expiry.getTime()) throw new Error(`panel expiry ${s?.expiresAt?.toISOString()} != sent ${expiry.toISOString()}`);
      return `expiry ${expiry.toISOString()} matches (epoch ms)`;
    });
    await guard('config link generation', async () => {
      const c = await provider.getConfig({ ...ref, subId: 'x' });
      const masked = c.config.replace(credential, '<credential>');
      return `${masked}${c.subscriptionUrl ? ` | sub: ${c.subscriptionUrl.replace(/[^/]+$/, '<subId>')}` : ' | no subscription url (XUI_SUB_BASE_URL unset)'}`;
    });
    await guard('subscription link serves the client', async () => {
      // the client above was created with a random subId; re-read its real subId from the panel
      const cfg = await provider.getConfig({ ...ref, subId: 'unused' });
      if (!cfg.subscriptionUrl) return 'skipped: XUI_SUB_BASE_URL not set (users get the direct config only)';
      const r = await fetchImpl(cfg.subscriptionUrl, { signal: AbortSignal.timeout(10_000), redirect: 'manual' });
      const body = (await r.text()).trim();
      if (r.status !== 200 || !body) throw new Error(`subscription URL ${cfg.subscriptionUrl.replace(/[^/]+$/, '<subId>')} answered HTTP ${r.status} with ${body ? 'a body' : 'no body'} — check XUI_SUB_BASE_URL (port/path/domain) and that the panel subscription service is enabled`);
      return `HTTP 200, ${body.length} bytes (${cfg.subscriptionUrl.replace(/[^/]+$/, '<subId>')})`;
    });
    await guard('renew (update expiry/traffic)', async () => {
      const exp2 = new Date(Date.now() + 2 * 86_400_000);
      const s = await provider.renewService({ ...ref, trafficLimitBytes: 2n * GB, expiresAt: exp2 });
      if (s.trafficLimit !== 2n * GB) throw new Error(`traffic limit after renew = ${s.trafficLimit}`);
      return 'updateClient applied and verified';
    });
    await guard('suspend + resume', async () => {
      await provider.suspendService(ref);
      if ((await provider.getServiceStatus(ref))?.enabled !== false) throw new Error('suspend not reflected');
      await provider.resumeService(ref);
      if ((await provider.getServiceStatus(ref))?.enabled !== true) throw new Error('resume not reflected');
      return 'ok';
    });
    await guard('idempotent create (retry adopts, no duplicate)', async () => {
      const r = await provider.createService({ ...ref, subId: 'x', telegramId: '0', trafficLimitBytes: 2n * GB, expiresAt: expiry });
      if (!r.adopted) throw new Error('second create did not adopt the existing client');
      return 'adopted existing client';
    });
  } finally {
    await guard('cleanup (delete test client)', async () => {
      await provider.deleteService(ref);
      if (await provider.getServiceStatus(ref)) throw new Error(`test client ${email} still exists — delete it manually in the panel`);
      return 'deleted and verified gone';
    });
  }
  return steps;
}

async function main() {
  const { env } = await import('../config/env');
  const e = env();
  if (!e.XUI_BASE_URL) throw new Error('XUI_BASE_URL is not set');
  const client = new XuiClient({ baseUrl: e.XUI_BASE_URL, username: e.XUI_USERNAME, password: e.XUI_PASSWORD, apiToken: e.XUI_API_TOKEN, fetchImpl: (await import('../providers/vpn/xui/net')).xuiFetch() });
  const provider = new XuiVpnProvider({ client, publicHost: e.XUI_PUBLIC_HOST ?? new URL(e.XUI_BASE_URL).hostname, subBaseUrl: e.XUI_SUB_BASE_URL });
  const argIdx = process.argv.indexOf('--inbound');
  const inbound = argIdx > 0 ? Number(process.argv[argIdx + 1]) : process.env.XUI_CHECK_INBOUND ? Number(process.env.XUI_CHECK_INBOUND) : undefined;
  console.log(`X-UI check → ${new URL(e.XUI_BASE_URL).origin}  auth=${e.XUI_API_TOKEN ? 'api-token' : 'session'}  inbound=${inbound ?? '(none)'}`);
  const steps = await runXuiCheck(client, provider, inbound, (s) => console.log(`${s.ok ? '✅ PASS' : '❌ FAIL'}  ${s.name}: ${s.detail}`), (await import('../providers/vpn/xui/net')).xuiFetch() ?? fetch);
  const failed = steps.filter((s) => !s.ok).length;
  console.log(failed ? `\n${failed} step(s) FAILED — do not sell until fixed.` : '\nAll steps passed.');
  process.exit(failed ? 1 : 0);
}
if (require.main === module) main().catch((e) => { console.error('❌', String(e?.message ?? e)); process.exit(1); });
