import { clientIp, parseJson, route } from "@/lib/server/http";
import { partnerRegisterSchema, registerPartner } from "@/lib/server/wholesale-register";

/** Public partner sign-up (no SMS/OTP): account + PENDING application. Wholesale access only starts after an admin approves it. */
export const POST = route(async (req) => registerPartner(await parseJson(req, partnerRegisterSchema), clientIp(req)));
