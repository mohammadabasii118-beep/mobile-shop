import type { Role } from "@/types";

// Web-Crypto only so it runs in both the Node runtime (route handlers) and the proxy.
const secret = () => process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
const enc = new TextEncoder();

export interface Session { email: string; name: string; role: Role; exp: number }

const b64 = (buf: ArrayBuffer | Uint8Array) => Buffer.from(buf as ArrayBuffer).toString("base64url");

async function sign(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

export async function createSessionToken(s: Omit<Session, "exp">, ttlSec = 60 * 60 * 24 * 7) {
  const payload = b64(enc.encode(JSON.stringify({ ...s, exp: Date.now() + ttlSec * 1000 })));
  return `${payload}.${await sign(payload)}`;
}

export async function verifySessionToken(token?: string): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || (await sign(payload)) !== sig) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}
