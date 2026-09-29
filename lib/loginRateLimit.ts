import { db } from "@/lib/db";

// Same idea as lib/trackLookup.ts's order-lookup limiter, applied to
// credentials login — before this, an attacker (or a leaked/guessed
// password list) could try unlimited passwords against any account,
// including admin ones, with nothing slowing them down.
const MAX_ATTEMPTS = 10;
const WINDOW_MINUTES = 15;

export async function isLoginRateLimited(email: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const recent = await db.loginAttempt.count({ where: { email, createdAt: { gte: windowStart } } });
  return recent >= MAX_ATTEMPTS;
}

export async function recordFailedLoginAttempt(email: string): Promise<void> {
  await db.loginAttempt.create({ data: { email } });
}
