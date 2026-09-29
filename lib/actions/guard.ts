import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("دسترسی غیرمجاز");
  }
  return session;
}

/**
 * Allows a real ADMIN (implicitly, always) or a STAFF account that was
 * actually granted `permission` (see User.permissions, set only from
 * /admin/staff by an ADMIN). This is the ONLY function that should ever
 * gate an action meant to also be reachable by staff — a plain
 * `requireAdmin()` stays ADMIN-only on purpose everywhere else.
 */
export async function requireStaffPermission(permission: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("دسترسی غیرمجاز");
  const role = (session.user as any).role;
  if (role === "ADMIN") return session;
  if (role === "STAFF" && Array.isArray((session.user as any).permissions) && (session.user as any).permissions.includes(permission)) {
    return session;
  }
  throw new Error("دسترسی غیرمجاز");
}

/** Either an ADMIN or any STAFF account — for self-service pages (like
 * two-factor setup) that only ever touch the signed-in user's own row and
 * carry no other staff data, so no specific permission is needed. */
export async function requireAdminOrStaff() {
  const session = await getServerSession(authOptions);
  const role = session && (session.user as any).role;
  if (role !== "ADMIN" && role !== "STAFF") throw new Error("دسترسی غیرمجاز");
  return session!;
}
