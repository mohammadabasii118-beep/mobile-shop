import { NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError, badRequest } from "@/lib/server/errors";
import { env } from "@/lib/server/env";
import { log, errorFields } from "@/lib/server/log";
import { rateLimit } from "@/lib/server/rate-limit";
import { createHash } from "node:crypto";
import { SESSION_COOKIE } from "@/lib/server/auth/session";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
/** Largest request body any endpoint accepts (several 5 MB files in one multipart form). Rejected by declared length before buffering. */
export const MAX_BODY_BYTES = 12 * 1024 * 1024;

/** Body-size cap and a per-session write limiter that backs up the specific limiters on money/upload/auth endpoints. */
async function guardWrite(req: NextRequest) {
  if (!WRITE_METHODS.has(req.method)) return;
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) throw new AppError(413, "payload_too_large", "حجم درخواست بیش از حد مجاز است.");
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) await rateLimit(`w:${createHash("sha256").update(token).digest("hex").slice(0, 24)}`, 240, 60);
}

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
      await guardWrite(req);
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
      const code = (e as { code?: string; name?: string })?.code;
      if ((e as { name?: string })?.name === "PrismaClientKnownRequestError") {
        if (code === "P2002") return Response.json({ ok: false, error: { code: "duplicate", message: "مقدار تکراری است؛ این شناسه/اسلاگ قبلاً استفاده شده." } }, { status: 409 });
        if (code === "P2003") return Response.json({ ok: false, error: { code: "in_use", message: "این مورد در بخش‌های دیگر استفاده شده و قابل حذف/تغییر نیست." } }, { status: 409 });
        if (code === "P2025") return Response.json({ ok: false, error: { code: "not_found", message: "مورد پیدا نشد." } }, { status: 404 });
      }
      const requestId = crypto.randomUUID().slice(0, 8);
      log("error", "api.unhandled", { requestId, method: req.method, path: new URL(req.url).pathname, ...errorFields(e) });
      return Response.json({ ok: false, error: { code: "internal", message: `خطای داخلی سرور. دوباره تلاش کنید. (کد پیگیری: ${requestId})` } }, { status: 500, headers: { "X-Request-Id": requestId } });
    }
  };
}
