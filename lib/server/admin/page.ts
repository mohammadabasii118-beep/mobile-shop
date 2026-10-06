import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "@/lib/server/auth/session";

/** Page-level guard (the API enforces the same permission independently). */
export async function requireAdminPage(perm: string | string[], here = "/admin"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/account?next=${encodeURIComponent(here)}`);
  const list = Array.isArray(perm) ? perm : [perm];
  if (!user.isStaff || !list.some((p) => user.permissions.includes(p))) redirect("/admin?denied=1");
  return user;
}
