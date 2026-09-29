import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { cookieSecure } from "@/lib/server/env";

export const SESSION_COOKIE = "cl_session";
const SESSION_DAYS = 30;
const RENEW_WHEN_LEFT_DAYS = 15;

export interface SessionUser {
  id: string;
  phone: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  roles: string[];
  permissions: string[];
  isStaff: boolean;
  /** Present only for an approved wholesale partner whose tier is active. Always derived from the DB. */
  wholesale: { tierKey: string; tierName: string; discountPercent: number; minOrder: number; storeName: string } | null;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function cookieOptions(expires: Date) {
  return { httpOnly: true, sameSite: "lax" as const, secure: cookieSecure(), path: "/", expires };
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const h = await headers();
  await db.session.create({ data: { tokenHash: sha256(token), userId, expiresAt, userAgent: h.get("user-agent")?.slice(0, 200) ?? null } });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(expiresAt));
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.set(SESSION_COOKIE, "", { ...cookieOptions(new Date(0)), maxAge: 0 });
}

export async function destroyAllSessions(userId: string, exceptTokenHash?: string) {
  await db.session.deleteMany({ where: { userId, ...(exceptTokenHash ? { NOT: { tokenHash: exceptTokenHash } } : {}) } });
}

export async function currentTokenHash() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? sha256(token) : undefined;
}

/** Loads the signed-in user (roles, permissions, wholesale eligibility) from the DB. Cached per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length < 20) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        include: {
          roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
          wholesaleProfile: { include: { tier: true } },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;

  // Sliding expiration (the cookie is re-issued from pages/handlers that can set cookies).
  if (session.expiresAt.getTime() - Date.now() < RENEW_WHEN_LEFT_DAYS * 86400_000) {
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
    await db.session.update({ where: { id: session.id }, data: { expiresAt } }).catch(() => {});
  }

  const u = session.user;
  const roles = u.roles.map((r) => r.role.key);
  const permissions = [...new Set(u.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key)))];
  const wp = u.wholesaleProfile;
  const wholesale = roles.includes("wholesale_partner") && wp && wp.tier.isActive
    ? { tierKey: wp.tier.key, tierName: wp.tier.name, discountPercent: wp.tier.discountPercent, minOrder: wp.tier.minOrder, storeName: wp.storeName }
    : null;
  return {
    id: u.id, phone: u.phone, email: u.email, firstName: u.firstName, lastName: u.lastName, displayName: u.displayName,
    roles, permissions, isStaff: u.roles.some((r) => r.role.isStaff), wholesale,
  };
});
