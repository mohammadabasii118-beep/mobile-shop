import https from 'node:https';
import http from 'node:http';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { env } from '../config/env';

type Agent = http.Agent | https.Agent;
let cached: { url?: string; agent?: Agent } = {};

/** Proxy agent for Telegram traffic (http/https/socks4/socks5), or undefined for a direct connection. */
export function telegramAgent(url = env().TELEGRAM_PROXY_URL): Agent | undefined {
  if (!url) return undefined;
  if (cached.url === url) return cached.agent;
  const agent: Agent = /^socks/i.test(url) ? new SocksProxyAgent(url) : new HttpsProxyAgent(url);
  cached = { url, agent };
  return agent;
}

export const telegramApiRoot = () => (env().TELEGRAM_API_ROOT ?? 'https://api.telegram.org').replace(/\/+$/, '');

/** Options for grammY's `client` so every API call honours TELEGRAM_API_ROOT / TELEGRAM_PROXY_URL. */
export function telegramClientOptions() {
  const agent = telegramAgent();
  return { apiRoot: telegramApiRoot(), ...(agent ? { baseFetchConfig: { agent } } : {}) };
}

/** GET a Telegram URL (file download, getMe…) through the same route as the bot. */
export function telegramGet(url: string, timeoutMs = 20_000): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.get(u, { agent: telegramAgent(), timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}
