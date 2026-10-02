import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { SESSION_COOKIE } from "@/config/app";
import { rateLimit } from "@/lib/security/rate-limit";
import { verifySessionToken, type Session } from "@/lib/security/session";
import type { Role } from "@/types";

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };

interface Ctx<P> { session: Session; params: P; request: Request }
type Handler<P> = (ctx: Ctx<P>) => Promise<unknown> | unknown;

/**
 * Wraps a route handler with: authentication → authorization (min role) → rate limiting → error mapping.
 * Every API route uses this so security is not re-implemented per endpoint.
 */
export function api<P = Record<string, string>>(handler: Handler<P>, opts: { role?: Role; limit?: number } = {}) {
  return async (request: Request, route: { params: Promise<P> }) => {
    const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (RANK[session.role] < RANK[opts.role ?? "viewer"]) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const rl = rateLimit(`${session.email}:${new URL(request.url).pathname}`, opts.limit ?? 120);
    if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    try {
      const result = await handler({ session, request, params: await route.params });
      return result instanceof Response ? result : NextResponse.json(result);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const json = await request.json().catch(() => ({}));
  const r = schema.safeParse(json);
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return r.data;
}

export const notFound = (what = "Resource") => new HttpError(404, `${what} not found`);
