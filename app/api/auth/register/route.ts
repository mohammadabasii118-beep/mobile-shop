import { clientIp, parseJson, route } from "@/lib/server/http";
import { registerWithEmail } from "@/lib/server/auth/service";
import { registerSchema } from "@/lib/server/validation";

/** Sign-up with full name + e-mail + password (no SMS/OTP). The new user is always a plain customer; the body accepts nothing else. */
export const POST = route(async (req) => registerWithEmail(await parseJson(req, registerSchema), clientIp(req)));
