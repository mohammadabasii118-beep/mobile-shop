import { sidecarConfig } from "@/config/instagram";
import { HttpError } from "@/lib/api";

export interface SidecarStatus { reachable: boolean; dryRun?: boolean; loggedIn?: boolean; username?: string; error?: string | null }

async function call(path: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { url, secret } = sidecarConfig();
  if (!secret) throw new HttpError(503, "IG_SIDECAR_SECRET is not set on the server");
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, { ...init, headers: { "X-Sidecar-Secret": secret, ...init.headers }, signal: AbortSignal.timeout(init.timeoutMs ?? 20_000) });
  } catch {
    throw new HttpError(503, "Instagram service is not running on the server");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = (data as { detail?: { kind?: string; message?: string } | string }).detail;
    const msg = typeof d === "string" ? d : d?.message ?? `Instagram service error (${res.status})`;
    throw new HttpError(res.status === 401 || res.status === 409 ? res.status : 502, msg);
  }
  return data as Record<string, unknown>;
}

export async function sidecarStatus(): Promise<SidecarStatus> {
  try {
    const d = await call("/status", { timeoutMs: 4000 });
    return { reachable: true, dryRun: Boolean(d.dryRun), loggedIn: Boolean(d.loggedIn), username: String(d.username ?? ""), error: (d.error as string | null) ?? null };
  } catch (e) {
    return { reachable: false, error: e instanceof Error ? e.message : "unreachable" };
  }
}

export async function sidecarLogin(code?: string) {
  const form = new FormData();
  form.set("code", code ?? "");
  return call("/login", { method: "POST", body: form, timeoutMs: 90_000 });
}

export async function sidecarPublish(kind: "photo" | "story", image: Uint8Array, caption: string) {
  const form = new FormData();
  form.set("file", new Blob([image as BlobPart], { type: "image/jpeg" }), "post.jpg");
  if (kind === "photo") form.set("caption", caption);
  const d = await call(`/publish/${kind}`, { method: "POST", body: form, timeoutMs: 120_000 });
  return { id: String(d.id ?? ""), dryRun: Boolean(d.dryRun) };
}
