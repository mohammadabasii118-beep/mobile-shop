import { clientIp, parseJson, route } from "@/lib/server/http";
import { verifyResetCode } from "@/lib/server/auth/service";
import { otpVerifySchema } from "@/lib/server/validation";

export const POST = route(async (req) => {
  const { phone, code } = await parseJson(req, otpVerifySchema);
  return verifyResetCode(phone, code, clientIp(req));
});
