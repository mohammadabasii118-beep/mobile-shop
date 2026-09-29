"use server";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireAdminOrStaff } from "./guard";
import { generateTotpSecret, totpAuthUrl, verifyTotp } from "@/lib/totp";
import { generateBackupCodes, hashBackupCodes } from "@/lib/backupCodes";
import { twoFactorConfirmSchema, twoFactorDisableSchema } from "@/lib/validation";

/**
 * Step 1 of setup: generates a fresh secret and stores it with
 * twoFactorEnabled still false — nothing is enforced yet. Returns the
 * secret and its otpauth:// URI so the page can show them once. Calling
 * this again before confirming simply overwrites the pending secret
 * (starting over cleanly), which is safe precisely because it isn't
 * enabled yet.
 */
export async function beginTwoFactorSetup() {
  const session = await requireAdminOrStaff();
  const userId = (session.user as any).id as string;
  const email = session.user.email as string;
  const secret = generateTotpSecret();
  await db.user.update({ where: { id: userId }, data: { twoFactorSecret: secret, twoFactorEnabled: false } });
  return { secret, otpauthUrl: totpAuthUrl(secret, email) };
}

/** Step 2: proves the app was set up correctly before 2FA starts being
 * enforced on login — a secret that was never actually confirmed working
 * can never lock the account out. Also generates this account's first set
 * of one-time backup codes and returns them in PLAINTEXT — the only moment
 * they're ever available outside their bcrypt hash — so the page can show
 * them to the user exactly once. */
export async function confirmTwoFactorSetup(formData: FormData): Promise<{ backupCodes: string[] }> {
  const session = await requireAdminOrStaff();
  const userId = (session.user as any).id as string;
  const raw = Object.fromEntries(formData.entries());
  const data = twoFactorConfirmSchema.parse(raw);

  const user = await db.user.findUnique({ where: { id: userId }, select: { twoFactorSecret: true } });
  if (!user?.twoFactorSecret) throw new Error("ابتدا راه‌اندازی را شروع کنید");
  if (!verifyTotp(user.twoFactorSecret, data.code)) throw new Error("کد وارد شده اشتباه است");

  const backupCodes = generateBackupCodes();
  const hashed = await hashBackupCodes(backupCodes);
  await db.user.update({ where: { id: userId }, data: { twoFactorEnabled: true, twoFactorBackupCodes: hashed } });
  revalidatePath("/admin/security");
  return { backupCodes };
}

/** Replaces this account's backup codes with a fresh set — e.g. after
 * using several, or if the old list may have been exposed. Requires the
 * current password (same rule as disabling 2FA outright) since this
 * invalidates every previously-issued code, including unused ones. Returns
 * the new codes in plaintext, once. */
export async function regenerateTwoFactorBackupCodes(formData: FormData): Promise<{ backupCodes: string[] }> {
  const session = await requireAdminOrStaff();
  const userId = (session.user as any).id as string;
  const raw = Object.fromEntries(formData.entries());
  const data = twoFactorDisableSchema.parse(raw); // same shape: just { password }

  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true, twoFactorEnabled: true } });
  if (!user) throw new Error("کاربر پیدا نشد");
  if (!user.twoFactorEnabled) throw new Error("ابتدا ورود دو مرحله‌ای را فعال کنید");
  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) throw new Error("رمز عبور اشتباه است");

  const backupCodes = generateBackupCodes();
  const hashed = await hashBackupCodes(backupCodes);
  await db.user.update({ where: { id: userId }, data: { twoFactorBackupCodes: hashed } });
  revalidatePath("/admin/security");
  return { backupCodes };
}

/** Requires the current password (not just being logged in) before turning
 * 2FA off — a stolen/left-open admin session alone shouldn't be enough to
 * disable the account's second factor. */
export async function disableTwoFactor(formData: FormData) {
  const session = await requireAdminOrStaff();
  const userId = (session.user as any).id as string;
  const raw = Object.fromEntries(formData.entries());
  const data = twoFactorDisableSchema.parse(raw);

  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw new Error("کاربر پیدا نشد");
  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) throw new Error("رمز عبور اشتباه است");

  await db.user.update({ where: { id: userId }, data: { twoFactorSecret: null, twoFactorEnabled: false, twoFactorBackupCodes: [] } });
  revalidatePath("/admin/security");
}

export async function getMyTwoFactorStatus() {
  const session = await getServerSession(authOptions);
  if (!session) return { enabled: false };
  const user = await db.user.findUnique({ where: { id: (session.user as any).id }, select: { twoFactorEnabled: true } });
  return { enabled: !!user?.twoFactorEnabled };
}
