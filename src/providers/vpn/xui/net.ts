import { Agent, fetch as undiciFetch } from 'undici';
import { env } from '../../../config/env';

/** Custom fetch for the X-UI panel. Only when XUI_TLS_INSECURE=true (self-signed panel certificate). */
export function xuiFetch(): typeof fetch | undefined {
  if (!env().XUI_TLS_INSECURE) return undefined;
  const dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
  return ((url: any, init: any) => undiciFetch(url, { ...init, dispatcher })) as unknown as typeof fetch;
}
