import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_CREDENTIALS, SESSION_COOKIE } from "@/config/app";
import { rateLimit } from "@/lib/security/rate-limit";
import { createSessionToken } from "@/lib/security/session";

// Secure cookies are dropped by browsers on plain http, so only set the flag when the request really is https
// (directly or behind a TLS-terminating proxy such as Nginx).
const isHttps = (req: Request) => new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`login:${ip}`, 10, 60_000).ok) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  // Demo auth. Production: look up the User table and verify a password hash (argon2/bcrypt).
  if (parsed.data.email !== DEMO_CREDENTIALS.email || parsed.data.password !== DEMO_CREDENTIALS.password) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const token = await createSessionToken({ email: parsed.data.email, name: "Admin", role: "admin" });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: isHttps(req), path: "/", maxAge: 60 * 60 * 24 * 7 });
  return res;
}
