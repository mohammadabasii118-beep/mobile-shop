import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

const CODE_COUNT = 8;
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I — avoids
// visually-ambiguous characters when a person copies a code down by hand.

function randomCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    if (i === 3) out += "-";
  }
  return out; // e.g. "7F3K-9QRT"
}

/** Generates a fresh set of one-time 2FA backup codes (plaintext — shown to
 * the user exactly once, at generation time, and never again). */
export function generateBackupCodes(count = CODE_COUNT): string[] {
  return Array.from({ length: count }, randomCode);
}

/** Hashes plaintext backup codes for storage — the same way passwords are
 * hashed, and for the same reason: a database leak must not hand out
 * usable codes. */
export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
}

/** Checks a candidate code against the user's stored hashed codes and
 * returns the index of the FIRST match, or -1 if none match. The caller is
 * responsible for removing that index from the array (one-time use — see
 * lib/auth.ts) once it's accepted. */
export async function findMatchingBackupCodeIndex(candidate: string, hashedCodes: string[]): Promise<number> {
  const normalized = candidate.trim().toUpperCase();
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(normalized, hashedCodes[i])) return i;
  }
  return -1;
}
