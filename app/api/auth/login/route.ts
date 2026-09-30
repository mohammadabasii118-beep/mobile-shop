import { clientIp, parseJson, route } from "@/lib/server/http";
import { loginWithPassword } from "@/lib/server/auth/service";
import { passwordLoginSchema } from "@/lib/server/validation";

export const POST = route(async (req) => {
  const { email, phone, password } = await parseJson(req, passwordLoginSchema);
  return loginWithPassword({ email, phone }, password, clientIp(req));
});
