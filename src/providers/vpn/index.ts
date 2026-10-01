import { env } from '../../config/env';
import { VpnProvider } from './types';
import { XuiClient } from './xui/client';
import { XuiVpnProvider } from './xui/provider';
import { MockVpnProvider } from './mock';

let provider: VpnProvider | undefined;

export function createVpnProvider(): VpnProvider {
  const e = env();
  if (e.VPN_PROVIDER === 'mock') {
    if (e.NODE_ENV === 'production') throw new Error('mock VPN provider is forbidden in production');
    return new MockVpnProvider();
  }
  if (!e.XUI_BASE_URL) throw new Error('XUI_BASE_URL is not configured');
  const publicHost = e.XUI_PUBLIC_HOST ?? new URL(e.XUI_BASE_URL).hostname;
  return new XuiVpnProvider({
    client: new XuiClient({ baseUrl: e.XUI_BASE_URL, username: e.XUI_USERNAME, password: e.XUI_PASSWORD, apiToken: e.XUI_API_TOKEN }),
    publicHost, subBaseUrl: e.XUI_SUB_BASE_URL,
  });
}

export function getVpnProvider(): VpnProvider {
  return (provider ??= createVpnProvider());
}
export function setVpnProvider(p: VpnProvider | undefined) {
  provider = p;
}
export const VPN_PROVIDER_ID = 'default';
