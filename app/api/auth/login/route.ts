import { clientIp, parseJson, route } from "@/lib/server/http";
import { loginWithPassword } from "@/lib/server/auth/service";
import { passwordLoginSchema } from "@/lib/server/validation";

export const POST = route(async (req) => {
  const { phone, password } = await parseJson(req, passwordLoginSchema);
  return loginWithPassword(phone, password, clientIp(req));
});
