import { clientIp, parseJson, route } from "@/lib/server/http";
import { loginWithOtp } from "@/lib/server/auth/service";
import { otpVerifySchema } from "@/lib/server/validation";

export const POST = route(async (req) => {
  const { phone, code } = await parseJson(req, otpVerifySchema);
  return loginWithOtp(phone, code, clientIp(req));
});
