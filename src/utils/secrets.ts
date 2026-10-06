import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from '../config/env';

/**
 * AES-256-GCM for secrets stored in the database (panel passwords / API tokens).
 * Key: SECRETS_KEY, else PANEL_SESSION_SECRET, else derived from BOT_TOKEN (rotating that value makes stored secrets unreadable —
 * set an explicit SECRETS_KEY once and keep it).
 */
function key(): Buffer {
  const e = env();
  const base = e.SECRETS_KEY ?? e.PANEL_SESSION_SECRET ?? e.BOT_TOKEN;
  if (!base) throw new Error('SECRETS_KEY (or PANEL_SESSION_SECRET / BOT_TOKEN) is required to store panel credentials');
  return createHash('sha256').update(`vpn-bot:secrets:${base}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `enc1:${iv.toString('base64url')}:${c.getAuthTag().toString('base64url')}:${ct.toString('base64url')}`;
}

export function decryptSecret(blob: string): string {
  const [v, iv, tag, ct] = blob.split(':');
  if (v !== 'enc1' || !iv || !tag || !ct) throw new Error('malformed secret');
  try {
    const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
  } catch {
    throw new Error('stored panel credentials cannot be decrypted (SECRETS_KEY changed?) — re-enter the panel password');
  }
}
