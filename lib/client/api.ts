export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; fields?: Record<string, string>; details?: unknown } };

/** Small fetch wrapper for our JSON API (same-origin, cookies included). */
export async function api<T = unknown>(method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    const res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body && !isForm ? { "content-type": "application/json" } : undefined,
      body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
    });
    return (await res.json()) as ApiResult<T>;
  } catch {
    return { ok: false, error: { code: "network", message: "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید." } };
  }
}

/** Only allow same-site relative redirects (open-redirect protection). */
export const safeNext = (raw: string | null | undefined, fallback = "/account/orders") =>
  raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : fallback;

export const toLatin = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
