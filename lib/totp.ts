// Minimal RFC 6238 (TOTP) / RFC 4226 (HOTP) implementation using only
// Node's built-in `crypto` module — deliberately no external dependency
// (otplib/speakeasy etc.), because this sandbox cannot run `npm install`
// to verify a new package actually resolves and works. This keeps the
// whole two-factor feature genuinely testable end-to-end with what is
// already in package.json.
//
// Compatible with any standard authenticator app (Google Authenticator,
// Authy, 1Password, Microsoft Authenticator, ...): 30-second step, 6
// digits, SHA-1 — the universal default those apps assume when an
// `otpauth://` URI (or a manually-typed secret) doesn't specify otherwise.

import crypto from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(buf: Buffer): string {
  let bits = "";
  for (const byte of buf) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  // Leftover bits (not enough for a full 5-bit group) — pad with zeros.
  const rem = bits.length % 5;
  if (rem > 0) {
    const last = bits.slice(bits.length - rem).padEnd(5, "0");
    out += BASE32_ALPHABET[parseInt(last, 2)];
  }
  return out;
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const ch of clean) {
    const val = BASE32_ALPHABET.indexOf(ch);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/** Generates a fresh random 20-byte (160-bit) secret, base32-encoded — the
 * standard size authenticator apps expect. */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

/** Builds the `otpauth://` URI an authenticator app can import (typed in
 * manually, or turned into a QR code by a general-purpose QR app/site —
 * this project does not render a QR image itself, see README ۱۳.۱۸). */
export function totpAuthUrl(secret: string, accountLabel: string, issuer = "CaseLine"): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  // Counter is a 64-bit big-endian integer; split across two 32-bit writes
  // since Node's Buffer has no native writeUInt64BE.
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter % 2 ** 32, 4);

  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binCode % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** Verifies a 6-digit code against the secret, allowing ±1 step (30s) of
 * clock drift — the tolerance every real-world TOTP verifier uses, since
 * phone/server clocks are never perfectly in sync. */
export function verifyTotp(secret: string, token: string, windowSteps = 1): boolean {
  const cleaned = (token || "").replace(/\D/g, "");
  if (cleaned.length !== DIGITS) return false;
  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let errorWindow = -windowSteps; errorWindow <= windowSteps; errorWindow++) {
    if (hotp(secret, counter + errorWindow) === cleaned) return true;
  }
  return false;
}
