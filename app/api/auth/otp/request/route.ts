import { z } from "zod";
import { clientIp, parseJson, route } from "@/lib/server/http";
import { requestOtp } from "@/lib/server/auth/service";
import { phoneSchema } from "@/lib/server/validation";

// Login codes can be requested for any number: this is also how accounts are created.
// Password reset uses /api/auth/forgot, which never reveals whether a number is registered.
export const POST = route(async (req) => {
  const { phone } = await parseJson(req, z.object({ phone: phoneSchema }));
  return requestOtp(phone, "login", clientIp(req));
});
