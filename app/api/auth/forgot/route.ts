import { z } from "zod";
import { clientIp, parseJson, route } from "@/lib/server/http";
import { requestEmailReset, requestPasswordReset } from "@/lib/server/auth/service";
import { emailSchema, phoneSchema } from "@/lib/server/validation";

/** Password recovery request: by e-mail (link) or by phone (code). The answer never reveals whether the account exists. */
export const POST = route(async (req) => {
  const d = await parseJson(req, z.union([z.object({ email: emailSchema }).strict(), z.object({ phone: phoneSchema }).strict()]));
  return "email" in d ? requestEmailReset(d.email, clientIp(req)) : requestPasswordReset(d.phone, clientIp(req));
});
