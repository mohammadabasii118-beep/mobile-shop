import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { forbidden } from "@/lib/server/errors";
import { clientIp, route } from "@/lib/server/http";
import { invalidatePublic } from "@/lib/server/public-cache";
import { rateLimit } from "@/lib/server/rate-limit";
import { requirePermission, requireUser } from "@/lib/server/auth/guard";
import type { SessionUser } from "@/lib/server/auth/session";

export type Db = Prisma.TransactionClient;
export interface AdminCtx { admin: SessionUser; ip: string }

/** Staff + at least one of the listed permissions. Throws 401/403; used by every admin API and page. */
export async function authorizeAdmin(perm: string | string[]): Promise<SessionUser> {
  const admin = await requireUser();
  if (!admin.isStaff) throw forbidden();
  const list = Array.isArray(perm) ? perm : [perm];
  if (!list.some((p) => admin.permissions.includes(p))) requirePermission(admin, list[0]!);
  return admin;
}

const WRITE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Wrapper for every admin API route: CSRF + uniform errors (route), authentication, staff check,
 * server-side permission check, and per-admin rate limiting (stricter for writes).
 */
export function adminRoute<P extends Record<string, string> = Record<string, string>>(
  perm: string | string[] | ((req: NextRequest, params: P) => string | string[]),
  handler: (req: NextRequest, params: P, a: AdminCtx) => Promise<unknown>,
) {
  return route<{ params: Promise<P> }>(async (req, ctx) => {
    const params = (await ctx.params) ?? ({} as P);
    const admin = await authorizeAdmin(typeof perm === "function" ? perm(req, params) : perm);
    await rateLimit(`admin:${WRITE.has(req.method) ? "w" : "r"}:${admin.id}`, WRITE.has(req.method) ? 240 : 900, 60);
    const result = await handler(req, params, { admin, ip: clientIp(req) });
    if (WRITE.has(req.method)) invalidatePublic(); // admin edits are visible on the storefront immediately
    return result;
  });
}

/** Append-only audit record. Pass the transaction client so the log commits atomically with the change. */
export async function audit(a: AdminCtx, action: string, entity: string, entityId: string | null, oldValue?: unknown, newValue?: unknown, tx: Db | typeof db = db) {
  const json = (v: unknown) => (v === undefined ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue));
  await tx.adminLog.create({ data: { adminId: a.admin.id, action, entity, entityId, oldValue: json(oldValue), newValue: json(newValue), ip: a.ip } });
}

/** Keeps only the keys that actually changed (for compact old/new audit values). */
export function diff(oldObj: Record<string, unknown>, patch: Record<string, unknown>) {
  const o: Record<string, unknown> = {}, n: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) {
    if (patch[k] === undefined) continue;
    if (JSON.stringify(oldObj[k] ?? null) !== JSON.stringify(patch[k] ?? null)) { o[k] = oldObj[k] ?? null; n[k] = patch[k] ?? null; }
  }
  return { old: o, next: n, changed: Object.keys(n).length > 0 };
}

export function pageParams(req: NextRequest, size = 20) {
  const u = new URL(req.url);
  const page = Math.max(1, Number(u.searchParams.get("page")) || 1);
  const per = Math.min(200, Math.max(1, Number(u.searchParams.get("per")) || size));
  return { page, take: per, skip: (page - 1) * per, q: (u.searchParams.get("q") ?? "").trim().slice(0, 80), sp: u.searchParams };
}
