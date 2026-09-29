import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { verifyTotp } from "@/lib/totp";
import { findMatchingBackupCodeIndex } from "@/lib/backupCodes";
import { isLoginRateLimited, recordFailedLoginAttempt } from "@/lib/loginRateLimit";

// A cookie marked "Secure" is silently dropped by the browser on plain HTTP
// (e.g. http://server-ip:3000). NextAuth infers this from NEXTAUTH_URL, but
// we make it explicit here so a stray "https://" in the env (or a proxy that
// changes the scheme) can never cause a session cookie to be lost silently.
const isHttps = (process.env.NEXTAUTH_URL || "").trim().startsWith("https://");

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies: isHttps,
  cookies: {
    sessionToken: {
      name: isHttps ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: isHttps },
    },
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "ایمیل", type: "email" },
        password: { label: "رمز عبور", type: "password" },
        // Only ever shown/used for ADMIN/STAFF accounts with 2FA enabled —
        // the login page reveals this field itself once it sees the
        // "2FA_REQUIRED" error below (see app/admin/login/page.tsx).
        code: { label: "کد دو مرحله‌ای", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Checked BEFORE touching the password/2FA at all, so a locked-out
        // attacker can't use timing or error differences to keep probing.
        if (await isLoginRateLimited(credentials.email)) {
          throw new Error("RATE_LIMITED");
        }

        const user = await db.user.findUnique({ where: { email: credentials.email } });
        if (!user) {
          await recordFailedLoginAttempt(credentials.email);
          return null;
        }
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) {
          await recordFailedLoginAttempt(credentials.email);
          return null;
        }

        if (user.twoFactorEnabled && user.twoFactorSecret) {
          if (!credentials.code) {
            // A distinct, machine-readable error the login page checks for
            // by exact string match to reveal the code field — never a
            // generic "invalid credentials" (that would hide that the
            // password was actually correct), and NOT counted as a failed
            // attempt (the password was right).
            throw new Error("2FA_REQUIRED");
          }
          if (!verifyTotp(user.twoFactorSecret, credentials.code)) {
            // Not a valid TOTP code — check whether it's one of this
            // account's one-time backup codes instead (for when the
            // authenticator app itself is unavailable). A match is
            // consumed immediately (removed from the stored list) so it
            // can never be reused, even by the legitimate owner.
            const idx = await findMatchingBackupCodeIndex(credentials.code, user.twoFactorBackupCodes);
            if (idx === -1) {
              await recordFailedLoginAttempt(credentials.email);
              throw new Error("کد دو مرحله‌ای نامعتبر است");
            }
            const remaining = [...user.twoFactorBackupCodes];
            remaining.splice(idx, 1);
            await db.user.update({ where: { id: user.id }, data: { twoFactorBackupCodes: remaining } });
          }
        }

        return { id: user.id, name: user.name, email: user.email, role: user.role, permissions: user.permissions } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = (user as any).id;
        token.permissions = (user as any).permissions || [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).permissions = token.permissions || [];
      }
      return session;
    },
  },
  // Surfaces auth problems in the server log unconditionally (not only in
  // debug mode), since this issue produced no errors anywhere by default.
  logger: {
    error(code, metadata) {
      console.error("[next-auth:error]", code, metadata);
    },
    warn(code) {
      console.warn("[next-auth:warn]", code);
    },
  },
};

