import { NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError, badRequest } from "@/lib/server/errors";
import { env } from "@/lib/server/env";

export const ok = <T>(data: T, init?: ResponseInit) => Response.json({ ok: true, data }, init);

export function clientIp(req: Request): string {
  if (env().TRUST_PROXY === "1") {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
  }
  return "direct";
}

/** CSRF defence for cookie-authenticated writes: a browser always sends Origin on cross-site POSTs. */
export function assertSameOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser client
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost = "";
  try { originHost = new URL(origin).host; } catch {}
  if (!host || originHost !== host) throw new AppError(403, "csrf", "درخواست نامعتبر است.");
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try { body = await req.json(); } catch { throw badRequest("بدنه درخواست نامعتبر است."); }
  return schema.parse(body);
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response | unknown>;

/** Wraps a route handler: CSRF check, uniform JSON errors, no stack traces to the client. */
export function route<C = { params: Promise<Record<string, string>> }>(handler: Handler<C>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      assertSameOrigin(req);
      const res = await handler(req, ctx);
      return res instanceof Response ? res : ok(res ?? null);
    } catch (e) {
      if (e instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const i of e.issues) fields[i.path.join(".") || "_"] = i.message;
        return Response.json({ ok: false, error: { code: "validation", message: Object.values(fields)[0] ?? "اطلاعات نامعتبر است.", fields } }, { status: 422 });
      }
      if (e instanceof AppError) {
        const headers: HeadersInit = {};
        if (e.status === 429 && e.details && typeof e.details === "object" && "retryAfter" in e.details) headers["Retry-After"] = String((e.details as { retryAfter: number }).retryAfter);
        return Response.json({ ok: false, error: { code: e.code, message: e.message, details: e.details } }, { status: e.status, headers });
      }
      console.error("[api] unhandled", e);
      return Response.json({ ok: false, error: { code: "internal", message: "خطای داخلی سرور. دوباره تلاش کنید." } }, { status: 500 });
    }
  };
}
