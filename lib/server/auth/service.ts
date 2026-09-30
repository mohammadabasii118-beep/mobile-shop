import { db } from "@/lib/db";
import { badRequest, conflict } from "@/lib/server/errors";
import { rateLimit } from "@/lib/server/rate-limit";
import { splitFullName } from "@/lib/server/validation";
import { issueOtp, verifyOtp, type OtpPurpose } from "@/lib/server/auth/otp";
import { dummyVerify, hashPassword, verifyPassword } from "@/lib/server/auth/password";
import { createSession, currentTokenHash, destroyAllSessions } from "@/lib/server/auth/session";
import { signTicket, verifyTicket } from "@/lib/server/auth/tickets";
import { mergeGuestCart } from "@/lib/server/cart";
import { createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/server/env";
import { log } from "@/lib/server/log";
import { mailConfigured, trySendMail } from "@/lib/server/mail";

const BAD_CREDENTIALS = () => badRequest("ایمیل/شماره موبایل یا رمز عبور نادرست است.", "bad_credentials");

async function finishLogin(userId: string) {
  await createSession(userId);
  await mergeGuestCart(userId);
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { firstName: true, lastName: true, passwordHash: true } });
  return { needsProfile: !u.firstName || !u.lastName, hasPassword: !!u.passwordHash };
}

/**
 * Phone-code sign-in is only for EXISTING accounts. It never creates one (registration is e-mail + password, no SMS), and a code is
 * only sent to a registered, active number; the answer is identical either way so it cannot be used to discover numbers.
 */
export async function requestOtp(phone: string, purpose: OtpPurpose, ip: string) {
  const user = await db.user.findUnique({ where: { phone }, select: { isActive: true } });
  if (!user?.isActive) { await rateLimit(`otp:req:ip:${ip}`, 15, 3600); return { expiresIn: 120, resendIn: 60 }; }
  return issueOtp(phone, purpose, ip);
}

export async function loginWithOtp(phone: string, code: string, ip: string) {
  await verifyOtp(phone, "login", code, ip);
  const user = await db.user.findUnique({ where: { phone } });
  if (!user) throw badRequest("کد تایید نادرست یا منقضی شده است.", "otp_invalid");
  if (!user.isActive) throw badRequest("این حساب غیرفعال است.", "account_disabled");
  if (!user.phoneVerifiedAt) await db.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } });
  return { registered: false, ...(await finishLogin(user.id)) };
}

export async function loginWithPassword(id: { email: string | null; phone: string | null }, password: string, ip: string) {
  const key = id.email ? `e:${id.email}` : `p:${id.phone}`;
  await rateLimit(`login:ip:${ip}`, 40, 900);
  await rateLimit(`login:id:${key}`, 8, 900);
  const user = id.email ? await db.user.findUnique({ where: { email: id.email } }) : await db.user.findUnique({ where: { phone: id.phone! } });
  if (!user || !user.passwordHash || !user.isActive) {
    await dummyVerify(password);
    throw BAD_CREDENTIALS();
  }
  if (!(await verifyPassword(password, user.passwordHash))) throw BAD_CREDENTIALS();
  return { registered: false, ...(await finishLogin(user.id)) };
}

/** Public registration: full name + e-mail + password. No phone, no SMS/OTP. Creates a plain customer and signs them in. */
export async function registerWithEmail(d: { fullName: string; email: string; password: string }, ip: string) {
  await rateLimit(`register:ip:${ip}`, 10, 3600);
  await rateLimit(`register:email:${d.email}`, 5, 3600);
  const existing = await db.user.findUnique({ where: { email: d.email }, select: { id: true } });
  if (existing) throw conflict("این ایمیل قبلاً ثبت شده است. لطفاً وارد حساب خود شوید.", "email_taken");
  const role = await db.role.findUniqueOrThrow({ where: { key: "customer" } });
  const { firstName, lastName } = splitFullName(d.fullName);
  let user;
  try {
    user = await db.user.create({ data: { email: d.email, passwordHash: await hashPassword(d.password), firstName, lastName, displayName: d.fullName, roles: { create: { roleId: role.id } } } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw conflict("این ایمیل قبلاً ثبت شده است. لطفاً وارد حساب خود شوید.", "email_taken"); // concurrent duplicate
    throw e;
  }
  return { registered: true, ...(await finishLogin(user.id)) };
}

/** Always answers the same way, so it cannot be used to discover registered numbers. */
export async function requestPasswordReset(phone: string, ip: string) {
  const user = await db.user.findUnique({ where: { phone }, select: { id: true, isActive: true } });
  if (user?.isActive) await issueOtp(phone, "reset", ip);
  else await rateLimit(`otp:req:ip:${ip}`, 15, 3600);
  return { expiresIn: 120 };
}

export async function verifyResetCode(phone: string, code: string, ip: string) {
  await verifyOtp(phone, "reset", code, ip);
  return { ticket: await signTicket("password-reset", phone, 600) };
}

export async function resetPassword(ticket: string, password: string) {
  const { phone } = await verifyTicket(ticket, "password-reset");
  const user = await db.user.findUnique({ where: { phone } });
  if (!user) throw badRequest("حساب پیدا نشد.");
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date() } });
  await destroyAllSessions(user.id); // every device must sign in again
  return { ok: true };
}

export async function updateProfile(userId: string, data: { firstName: string; lastName: string; displayName?: string; email?: string }) {
  if (data.email) {
    const taken = await db.user.findFirst({ where: { email: data.email, NOT: { id: userId } }, select: { id: true } });
    if (taken) throw conflict("این ایمیل قبلاً استفاده شده است.", "email_taken");
  }
  return db.user.update({
    where: { id: userId },
    data: { firstName: data.firstName, lastName: data.lastName, displayName: data.displayName ?? `${data.firstName} ${data.lastName}`, email: data.email ?? null },
    select: { id: true, firstName: true, lastName: true, displayName: true, email: true },
  });
}

export async function changePassword(userId: string, oldPassword: string | undefined, newPassword: string) {
  await rateLimit(`pwchange:${userId}`, 8, 900);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.passwordHash) {
    if (!oldPassword || !(await verifyPassword(oldPassword, user.passwordHash))) throw badRequest("رمز عبور فعلی نادرست است.", "bad_password");
  }
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date() } });
  await destroyAllSessions(userId, await currentTokenHash()); // keep only this device signed in
}

/* ───────── password reset by e-mail ───────── */

const RESET_TTL_MIN = 60;
const sha256hex = (v: string) => createHash("sha256").update(v).digest("hex");

/**
 * Sends a one-time reset link to a registered e-mail. The answer never depends on whether the address exists (no enumeration):
 * rate limits are checked first for every address, the real work runs after the response is decided, and failures are only logged.
 */
export async function requestEmailReset(email: string, ip: string) {
  await rateLimit(`pwreset:ip:${ip}`, 10, 3600);
  await rateLimit(`pwreset:email:${email}`, 3, 3600);
  void sendResetEmail(email).catch((e) => log("error", "password_reset_email_failed", { error: String((e as Error).message).slice(0, 200) }));
  return { sent: true };
}

async function sendResetEmail(email: string) {
  if (!mailConfigured()) { log("warn", "password_reset_email_skipped", { reason: "EMAIL_SMTP_URL not configured" }); return; }
  const user = await db.user.findUnique({ where: { email }, select: { id: true, isActive: true, passwordHash: true } });
  if (!user?.isActive) return;
  const token = randomBytes(32).toString("base64url"); // 256 bits; only its SHA-256 is stored
  await db.$transaction([
    db.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }), // only the newest link works
    db.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256hex(token), expiresAt: new Date(Date.now() + RESET_TTL_MIN * 60_000) } }),
  ]);
  const link = `${env().APP_URL.replace(/\/$/, "")}/account?reset=${token}`;
  await trySendMail({
    to: email, subject: "بازیابی رمز عبور کیس‌لاین",
    text: `برای انتخاب رمز عبور جدید روی لینک زیر بزنید (اعتبار: ${RESET_TTL_MIN} دقیقه، فقط یک بار):\n${link}\n\nاگر شما این درخواست را نداده‌اید، این ایمیل را نادیده بگیرید؛ رمز شما تغییری نمی‌کند.`,
  });
}

/** Consumes a reset link (single use, expiring), sets the new password and signs every device out. */
export async function resetPasswordWithToken(token: string, password: string, ip: string) {
  await rateLimit(`pwreset:use:ip:${ip}`, 30, 900);
  const INVALID = () => badRequest("لینک بازیابی نامعتبر است یا منقضی شده. دوباره درخواست دهید.", "reset_token_invalid");
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256hex(token) }, include: { user: { select: { id: true, isActive: true } } } });
  if (!row || row.usedAt || row.expiresAt < new Date() || !row.user.isActive) throw INVALID();
  const passwordHash = await hashPassword(password);
  const claimed = await db.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } }); // atomic: only one caller wins
  if (!claimed.count) throw INVALID();
  await db.user.update({ where: { id: row.userId }, data: { passwordHash, passwordChangedAt: new Date() } });
  await db.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } });
  await destroyAllSessions(row.userId);
  return { ok: true };
}
