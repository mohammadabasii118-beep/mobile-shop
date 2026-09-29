import { clientIp, parseJson, route } from "@/lib/server/http";
import { requestPasswordReset } from "@/lib/server/auth/service";
import { phoneSchema } from "@/lib/server/validation";
import { z } from "zod";

export const POST = route(async (req) => {
  const { phone } = await parseJson(req, z.object({ phone: phoneSchema }));
  return requestPasswordReset(phone, clientIp(req));
});
