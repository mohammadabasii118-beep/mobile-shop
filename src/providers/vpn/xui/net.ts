import { Agent, fetch as undiciFetch } from 'undici';

const agents = new Map<boolean, Agent>();

/**
 * Dedicated fetch for X-UI panels.
 * - Short keep-alive: panels (Go/gin behind NAT or a reverse proxy) silently drop idle sockets; reusing a dead pooled
 *   socket is the classic cause of "random" ECONNRESET / "other side closed" errors across borders.
 * - `insecure` accepts a self-signed panel certificate (per panel).
 */
export function xuiFetch(insecure = false): typeof fetch {
  let agent = agents.get(insecure);
  if (!agent) {
    agent = new Agent({ keepAliveTimeout: 3_000, keepAliveMaxTimeout: 3_000, connect: { timeout: 10_000, ...(insecure ? { rejectUnauthorized: false } : {}) } });
    agents.set(insecure, agent);
  }
  const dispatcher = agent;
  return ((url: any, init: any) => undiciFetch(url, { ...init, dispatcher })) as unknown as typeof fetch;
}
