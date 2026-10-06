import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/server/env";
import { badRequest } from "@/lib/server/errors";

const key = () => new TextEncoder().encode(env().AUTH_SECRET);

/** Short-lived signed ticket proving a phone passed OTP verification for a specific purpose (e.g. password reset). */
export async function signTicket(purpose: string, phone: string, ttlSec = 600) {
  return new SignJWT({ purpose, phone }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${ttlSec}s`).sign(key());
}

export async function verifyTicket(token: string, purpose: string): Promise<{ phone: string }> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.purpose !== purpose || typeof payload.phone !== "string") throw new Error("purpose");
    return { phone: payload.phone };
  } catch {
    throw badRequest("اعتبار این درخواست تمام شده است. دوباره تلاش کنید.", "ticket_invalid");
  }
}
