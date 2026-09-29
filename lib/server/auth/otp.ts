import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/server/env";
import { badRequest, tooMany } from "@/lib/server/errors";
import { rateLimit } from "@/lib/server/rate-limit";
import { getSmsProvider } from "@/lib/server/auth/sms";

export const OTP_TTL_SEC = 120;
export const OTP_LENGTH = 4;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SEC = 60;

export type OtpPurpose = "login" | "reset";

const hashCode = (phone: string, purpose: string, code: string) =>
  createHmac("sha256", env().AUTH_SECRET).update(`otp:${phone}:${purpose}:${code}`).digest("hex");

/** Exported for tests only. */
export const __hashOtpForTests = hashCode;

export async function issueOtp(phone: string, purpose: OtpPurpose, ip: string) {
  await rateLimit(`otp:req:ip:${ip}`, 15, 3600);
  await rateLimit(`otp:req:phone:${phone}`, 5, 900);

  const last = await db.otpCode.findFirst({ where: { phone, purpose }, orderBy: { createdAt: "desc" } });
  if (last) {
    const wait = RESEND_COOLDOWN_SEC - Math.floor((Date.now() - last.createdAt.getTime()) / 1000);
    if (wait > 0) throw tooMany(wait);
  }

  const code = String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
  // Only the newest code can ever be valid.
  await db.otpCode.updateMany({ where: { phone, purpose, usedAt: null }, data: { usedAt: new Date() } });
  await db.otpCode.create({ data: { phone, purpose, ip, codeHash: hashCode(phone, purpose, code), expiresAt: new Date(Date.now() + OTP_TTL_SEC * 1000) } });
  await getSmsProvider().send(phone, `کد تایید کیس‌لاین: ${code}`);
  return { expiresIn: OTP_TTL_SEC, resendIn: RESEND_COOLDOWN_SEC };
}

const INVALID = () => badRequest("کد تایید نادرست یا منقضی شده است.", "otp_invalid");

/** Verifies and consumes a code. Single use, expiring, attempt-limited. */
export async function verifyOtp(phone: string, purpose: OtpPurpose, code: string, ip: string) {
  await rateLimit(`otp:verify:ip:${ip}`, 40, 600);
  await rateLimit(`otp:verify:phone:${phone}`, 12, 600);

  const rec = await db.otpCode.findFirst({ where: { phone, purpose, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!rec) throw INVALID();
  if (rec.attempts >= MAX_ATTEMPTS) {
    await db.otpCode.update({ where: { id: rec.id }, data: { usedAt: new Date() } });
    throw INVALID();
  }
  const a = Buffer.from(rec.codeHash, "hex");
  const b = Buffer.from(hashCode(phone, purpose, code), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    const upd = await db.otpCode.update({ where: { id: rec.id }, data: { attempts: { increment: 1 } } });
    if (upd.attempts >= MAX_ATTEMPTS) await db.otpCode.update({ where: { id: rec.id }, data: { usedAt: new Date() } });
    throw INVALID();
  }
  // Atomic consume: a second concurrent request with the same code loses this race.
  const used = await db.otpCode.updateMany({ where: { id: rec.id, usedAt: null }, data: { usedAt: new Date() } });
  if (used.count !== 1) throw INVALID();
}
