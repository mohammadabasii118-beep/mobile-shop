import { parseJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { changePassword } from "@/lib/server/auth/service";
import { changePasswordSchema } from "@/lib/server/validation";

export const POST = route(async (req) => {
  const u = await requireUser();
  const { oldPassword, newPassword } = await parseJson(req, changePasswordSchema);
  await changePassword(u.id, oldPassword, newPassword);
  return { changed: true };
});
