import { createHmac, timingSafeEqual } from "node:crypto";

/** Tokens are never sent to the browser in full. */
export function maskSecret(value: string) {
  if (!value) return "";
  return `${value.slice(0, 4)}${"•".repeat(12)}${value.slice(-4)}`;
}

/** Webhook verification (Meta: X-Hub-Signature-256 = "sha256=<hmac of raw body>"). */
export function verifyHmacSignature(rawBody: string, signatureHeader: string | null, secret: string) {
  if (!signatureHeader) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}
