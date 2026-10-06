import { clientIp, route } from "@/lib/server/http";
import { resetPassword, resetPasswordWithToken } from "@/lib/server/auth/service";
import { resetSchema, resetTokenSchema } from "@/lib/server/validation";

/** Sets a new password from either a phone-code ticket or an e-mail link token. */
export const POST = route(async (req) => {
  const body = await req.json().catch(() => ({}));
  if (body && typeof body === "object" && "token" in body) {
    const { token, password } = resetTokenSchema.parse(body);
    return resetPasswordWithToken(token, password, clientIp(req));
  }
  const { ticket, password } = resetSchema.parse(body);
  return resetPassword(ticket, password);
});
