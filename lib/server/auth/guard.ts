import { redirect } from "next/navigation";
import { forbidden, unauthorized } from "@/lib/server/errors";
import { getCurrentUser, type SessionUser } from "@/lib/server/auth/session";

/** API guard: throws 401 when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

/** Page guard: redirects to the login page (keeping the destination) when signed out. */
export async function requirePageUser(nextPath: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/account?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export const hasPermission = (user: SessionUser, key: string) => user.permissions.includes(key);

/** Server-side authorization for sensitive operations. Never rely on hidden buttons. */
export function requirePermission(user: SessionUser, key: string) {
  if (!hasPermission(user, key)) throw forbidden();
}

/** Only allow same-site relative redirects. */
export function safeNext(raw: unknown, fallback = "/account/orders") {
  return typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : fallback;
}
