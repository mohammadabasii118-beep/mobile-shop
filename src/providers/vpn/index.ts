import { env } from '../../config/env';
import { prisma } from '../../db/client';
import { decryptSecret } from '../../utils/secrets';
import { ProviderError, VpnProvider } from './types';
import { XuiClient } from './xui/client';
import { XuiVpnProvider } from './xui/provider';
import { MockVpnProvider } from './mock';
import { xuiFetch } from './xui/net';

/** Everything needed to talk to one 3x-ui panel. */
export interface PanelConfig {
  baseUrl: string;
  username?: string | null;
  password?: string | null;
  apiToken?: string | null;
  subBaseUrl?: string | null;
  publicHost?: string | null;
  tlsInsecure?: boolean;
}

export const DEFAULT_PANEL = 'default';

export function providerFromConfig(c: PanelConfig): VpnProvider {
  const publicHost = c.publicHost || new URL(c.baseUrl).hostname;
  return new XuiVpnProvider({
    client: new XuiClient({ baseUrl: c.baseUrl, username: c.username ?? undefined, password: c.password ?? undefined, apiToken: c.apiToken ?? undefined, fetchImpl: xuiFetch(!!c.tlsInsecure) }),
    publicHost, subBaseUrl: c.subBaseUrl ?? undefined,
  });
}

/** The panel configured through XUI_* environment variables (code "default"), if any. */
export function envPanelConfig(): PanelConfig | null {
  const e = env();
  if (!e.XUI_BASE_URL) return null;
  return { baseUrl: e.XUI_BASE_URL, username: e.XUI_USERNAME, password: e.XUI_PASSWORD, apiToken: e.XUI_API_TOKEN, subBaseUrl: e.XUI_SUB_BASE_URL, publicHost: e.XUI_PUBLIC_HOST, tlsInsecure: e.XUI_TLS_INSECURE };
}

let override: VpnProvider | undefined; // tests / demo: one provider for every panel code
let mock: MockVpnProvider | undefined;
const cache = new Map<string, { version: string; provider: VpnProvider }>();

/**
 * The provider for a panel code (Product.xuiProviderId / VpnService.provider).
 * Instances are cached so the panel session cookie survives between calls; a changed panel row rebuilds it.
 */
export async function vpnFor(code: string = DEFAULT_PANEL): Promise<VpnProvider> {
  if (override) return override;
  const e = env();
  if (e.VPN_PROVIDER === 'mock') {
    if (e.NODE_ENV === 'production') throw new Error('mock VPN provider is forbidden in production');
    return (mock ??= new MockVpnProvider());
  }
  const row = await prisma.panel.findUnique({ where: { code } });
  if (row) {
    const version = `${row.id}:${row.updatedAt.getTime()}`;
    const hit = cache.get(code);
    if (hit?.version === version) return hit.provider;
    let password: string | undefined, apiToken: string | undefined;
    try {
      password = row.passwordEnc ? decryptSecret(row.passwordEnc) : undefined;
      apiToken = row.apiTokenEnc ? decryptSecret(row.apiTokenEnc) : undefined;
    } catch (err: any) { throw new ProviderError(`panel "${code}": ${err.message}`, false); }
    const provider = providerFromConfig({ ...row, password, apiToken });
    cache.set(code, { version, provider });
    return provider;
  }
  if (code === DEFAULT_PANEL) {
    const cfg = envPanelConfig();
    if (!cfg) throw new ProviderError('no X-UI panel is configured (add one in the admin panel or set XUI_BASE_URL)', false);
    const hit = cache.get(code);
    if (hit?.version === 'env') return hit.provider;
    const provider = providerFromConfig(cfg);
    cache.set(code, { version: 'env', provider });
    return provider;
  }
  throw new ProviderError(`panel "${code}" does not exist (deleted?)`, false);
}

/** True when one fixed provider serves every panel code (tests/demo/mock) — there is no panel registry to consult. */
export const usesFixedProvider = () => !!override || env().VPN_PROVIDER === 'mock';

export function setVpnProvider(p: VpnProvider | undefined) {
  override = p;
  cache.clear();
}
