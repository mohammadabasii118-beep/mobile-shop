import { parseJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { updateProfile } from "@/lib/server/auth/service";
import { profileSchema } from "@/lib/server/validation";

export const GET = route(async () => {
  const u = await requireUser();
  return { id: u.id, phone: u.phone, email: u.email, firstName: u.firstName, lastName: u.lastName, displayName: u.displayName, roles: u.roles, wholesale: u.wholesale };
});

// Only whitelisted profile fields are accepted; roles/permissions can never be changed from here.
export const PATCH = route(async (req) => {
  const u = await requireUser();
  return updateProfile(u.id, await parseJson(req, profileSchema));
});
