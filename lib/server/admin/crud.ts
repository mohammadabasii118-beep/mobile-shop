import { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/server/errors";
import { audit, diff, pageParams, type AdminCtx, type Db } from "@/lib/server/admin/core";
import { recordSlugChange } from "@/lib/server/redirects";
import { RESOURCES, type Resource } from "@/lib/server/admin/resources";
import type { NextRequest } from "next/server";

export function resource(key: string): Resource {
  const r = RESOURCES[key];
  if (!r) throw notFound("بخش پیدا نشد.");
  return r;
}
// Prisma delegates are looked up by name; the registry is the only caller.
/* eslint-disable @typescript-eslint/no-explicit-any */
const delegate = (tx: Db | typeof db, r: Resource): any => (tx as any)[r.model];

export async function listResource(key: string, req: NextRequest) {
  const r = resource(key);
  const { take, skip, q, page, sp } = pageParams(req, 30);
  const where: Record<string, unknown> = {};
  if (q && r.search.length) where.OR = r.search.map((f) => ({ [f]: { contains: q, mode: "insensitive" } }));
  for (const f of r.filters ?? []) {
    const v = sp.get(f);
    if (v === null || v === "") continue;
    where[f] = v === "true" ? true : v === "false" ? false : v;
  }
  const [items, total] = await Promise.all([
    delegate(db, r).findMany({ where, orderBy: r.orderBy, take, skip, ...(r.include ? { include: r.include } : {}) }),
    delegate(db, r).count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / take)) };
}

export async function getResource(key: string, id: string) {
  const r = resource(key);
  const row = await delegate(db, r).findUnique({ where: { id }, ...(r.include ? { include: r.include } : {}) });
  if (!row) throw notFound();
  return row;
}

export async function createResource(key: string, body: unknown, a: AdminCtx) {
  const r = resource(key);
  const data = r.create.parse(body) as Record<string, unknown>;
  return db.$transaction(async (tx) => {
    if (r.hasSort && data.sortOrder === undefined) {
      const agg = await delegate(tx, r).aggregate({ _max: { sortOrder: true } });
      data.sortOrder = (agg._max.sortOrder ?? 0) + 1;
    }
    await r.guard?.(tx, data, null);
    const row = await delegate(tx, r).create({ data });
    await audit(a, `${r.auditName}.create`, r.auditName, row.id, undefined, data, tx);
    return row;
  });
}

export async function updateResource(key: string, id: string, body: unknown, a: AdminCtx) {
  const r = resource(key);
  const patch = r.create.partial().parse(body) as Record<string, unknown>;
  for (const f of r.immutable ?? []) delete patch[f];
  if (!Object.keys(patch).length) throw badRequest("تغییری ارسال نشده است.");
  return db.$transaction(async (tx) => {
    const existing = await delegate(tx, r).findUnique({ where: { id } });
    if (!existing) throw notFound();
    await r.guard?.(tx, patch, existing);
    const d = diff(existing, patch);
    if (!d.changed) return existing;
    const row = await delegate(tx, r).update({ where: { id }, data: patch });
    if (r.slugKind && typeof patch.slug === "string" && patch.slug !== existing.slug) await recordSlugChange(tx, r.slugKind, String(existing.slug), patch.slug);
    await audit(a, `${r.auditName}.update`, r.auditName, id, d.old, d.next, tx);
    return row;
  });
}

export async function deleteResource(key: string, id: string, a: AdminCtx) {
  const r = resource(key);
  return db.$transaction(async (tx) => {
    const existing = await delegate(tx, r).findUnique({ where: { id } });
    if (!existing) throw notFound();
    await r.beforeDelete?.(tx, id);
    await delegate(tx, r).delete({ where: { id } });
    await audit(a, `${r.auditName}.delete`, r.auditName, id, existing, undefined, tx);
    return { deleted: true };
  });
}

const reorderSchema = z.object({ ids: z.array(z.string().max(40)).min(1).max(500) });
/** Persists a drag/arrow order: sortOrder = position in the submitted list. */
export async function reorderResource(key: string, body: unknown, a: AdminCtx) {
  const r = resource(key);
  if (!r.hasSort) throw badRequest("این بخش ترتیب‌پذیر نیست.");
  const { ids } = reorderSchema.parse(body);
  return db.$transaction(async (tx) => {
    const found = await delegate(tx, r).count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw notFound("برخی موارد پیدا نشد.");
    for (let i = 0; i < ids.length; i++) await delegate(tx, r).update({ where: { id: ids[i] }, data: { sortOrder: i + 1 } });
    await audit(a, `${r.auditName}.reorder`, r.auditName, null, undefined, { ids }, tx);
    return { ok: true };
  });
}
