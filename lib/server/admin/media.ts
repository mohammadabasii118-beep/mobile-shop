import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { audit, type AdminCtx } from "@/lib/server/admin/core";
import { badRequest, conflict, notFound } from "@/lib/server/errors";
import { processImage, validateVideo } from "@/lib/server/media-files";
import { getPublicStorage } from "@/lib/server/storage/public";

export const MAX_IMAGES_PER_PRODUCT = 12;
export const MAX_VIDEOS_PER_PRODUCT = 3;

const select = { id: true, type: true, url: true, alt: true, caption: true, sortOrder: true, isPrimary: true, mimeType: true, fileSize: true, width: true, height: true, createdAt: true, updatedAt: true } as const;
const ORDER = [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }, { id: "asc" as const }];

export const mediaPatchSchema = z.object({
  alt: z.string().trim().max(160).nullable().optional(),
  caption: z.string().trim().max(200).nullable().optional(),
  isPrimary: z.literal(true).optional(),
});
export const mediaReorderSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(MAX_IMAGES_PER_PRODUCT + MAX_VIDEOS_PER_PRODUCT) });

/** Serialises every media mutation of one product (primary uniqueness, sortOrder, limits) with a row lock. */
async function lockProduct(tx: Prisma.TransactionClient, productId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "Product" WHERE "id" = ${productId} FOR UPDATE`);
  if (!rows.length) throw notFound("محصول پیدا نشد.");
}

export const listMedia = (productId: string) => db.productImage.findMany({ where: { productId }, orderBy: ORDER, select });

/** Renumbers 0..n-1 and guarantees exactly one primary IMAGE (first image if none). Call inside the product lock. */
async function normalize(tx: Prisma.TransactionClient, productId: string) {
  const all = await tx.productImage.findMany({ where: { productId }, orderBy: ORDER, select: { id: true, type: true, isPrimary: true, sortOrder: true } });
  for (const [i, m] of all.entries()) if (m.sortOrder !== i) await tx.productImage.update({ where: { id: m.id }, data: { sortOrder: i } });
  const images = all.filter((m) => m.type === "IMAGE");
  const primary = images.find((m) => m.isPrimary) ?? images[0];
  for (const m of images) if (m.isPrimary && m.id !== primary?.id) await tx.productImage.update({ where: { id: m.id }, data: { isPrimary: false } });
  if (primary && !primary.isPrimary) await tx.productImage.update({ where: { id: primary.id }, data: { isPrimary: true } });
}

export async function uploadMedia(productId: string, kind: "IMAGE" | "VIDEO", file: File, meta: { alt?: string | null; caption?: string | null }, a: AdminCtx) {
  const buf = Buffer.from(await file.arrayBuffer());
  let key: string, data: Buffer, row: Omit<Prisma.ProductImageUncheckedCreateInput, "productId" | "url" | "sortOrder" | "isPrimary">;
  if (kind === "IMAGE") {
    const img = await processImage(file, buf);
    key = `images/${randomUUID()}.${img.ext}`; data = img.data;
    row = { type: "IMAGE", mimeType: img.mime, fileSize: img.size, width: img.width, height: img.height };
  } else {
    const v = validateVideo(file, buf);
    key = `videos/${randomUUID()}.${v.ext}`; data = buf;
    row = { type: "VIDEO", mimeType: v.mime, fileSize: v.size };
  }
  await getPublicStorage().put(key, data);
  try {
    const created = await db.$transaction(async (tx) => {
      await lockProduct(tx, productId);
      const existing = await tx.productImage.findMany({ where: { productId }, select: { type: true, isPrimary: true, sortOrder: true } });
      const count = existing.filter((m) => m.type === kind).length;
      if (kind === "IMAGE" && count >= MAX_IMAGES_PER_PRODUCT) throw conflict(`حداکثر ${MAX_IMAGES_PER_PRODUCT} تصویر برای هر محصول مجاز است.`, "media_limit");
      if (kind === "VIDEO" && count >= MAX_VIDEOS_PER_PRODUCT) throw conflict(`حداکثر ${MAX_VIDEOS_PER_PRODUCT} ویدیو برای هر محصول مجاز است.`, "media_limit");
      const m = await tx.productImage.create({
        data: { ...row, productId, url: `/media/${key}`, alt: meta.alt || null, caption: meta.caption || null, sortOrder: existing.reduce((mx, e) => Math.max(mx, e.sortOrder), -1) + 1, isPrimary: kind === "IMAGE" && !existing.some((e) => e.isPrimary) },
        select,
      });
      await audit(a, "media.add", "product", productId, undefined, { id: m.id, type: kind, size: data.length }, tx);
      return m;
    });
    return created;
  } catch (e) {
    await getPublicStorage().delete(key).catch(() => {});
    throw e;
  }
}

export async function updateMedia(productId: string, mediaId: string, patch: z.infer<typeof mediaPatchSchema>, a: AdminCtx) {
  return db.$transaction(async (tx) => {
    await lockProduct(tx, productId);
    const m = await tx.productImage.findFirst({ where: { id: mediaId, productId }, select });
    if (!m) throw notFound("رسانه پیدا نشد.");
    if (patch.isPrimary) {
      if (m.type !== "IMAGE") throw badRequest("فقط تصویر می‌تواند تصویر اصلی باشد.", "media_primary_type");
      await tx.productImage.updateMany({ where: { productId, isPrimary: true, id: { not: mediaId } }, data: { isPrimary: false } });
    }
    const out = await tx.productImage.update({ where: { id: mediaId }, data: { ...(patch.alt !== undefined ? { alt: patch.alt || null } : {}), ...(patch.caption !== undefined ? { caption: patch.caption || null } : {}), ...(patch.isPrimary ? { isPrimary: true } : {}) }, select });
    await audit(a, "media.update", "product", productId, { id: mediaId, alt: m.alt, caption: m.caption, isPrimary: m.isPrimary }, { alt: out.alt, caption: out.caption, isPrimary: out.isPrimary }, tx);
    return out;
  });
}

/** Deleting media never touches the product. Deleting the primary promotes the next image so a photo is still shown. */
export async function deleteMedia(productId: string, mediaId: string, a: AdminCtx) {
  const url = await db.$transaction(async (tx) => {
    await lockProduct(tx, productId);
    const m = await tx.productImage.findFirst({ where: { id: mediaId, productId }, select });
    if (!m) throw notFound("رسانه پیدا نشد.");
    await tx.productImage.delete({ where: { id: mediaId } });
    await normalize(tx, productId);
    await audit(a, "media.delete", "product", productId, { id: mediaId, type: m.type, wasPrimary: m.isPrimary }, undefined, tx);
    return m.url;
  });
  const key = url.replace(/^\/media\//, "");
  if (/^(images|videos)\//.test(key) && !(await db.productImage.count({ where: { url } }))) await getPublicStorage().delete(key).catch(() => {});
  return { deleted: true };
}

/** `ids` must be exactly the product's media in the desired order; sortOrder becomes the index (deterministic). */
export async function reorderMedia(productId: string, ids: string[], a: AdminCtx) {
  await db.$transaction(async (tx) => {
    await lockProduct(tx, productId);
    const cur = await tx.productImage.findMany({ where: { productId }, select: { id: true } });
    if (new Set(ids).size !== ids.length || ids.length !== cur.length || !cur.every((c) => ids.includes(c.id))) throw badRequest("فهرست رسانه‌ها با وضعیت فعلی هم‌خوانی ندارد.", "media_reorder_mismatch");
    for (const [i, id] of ids.entries()) await tx.productImage.update({ where: { id }, data: { sortOrder: i } });
    await audit(a, "media.reorder", "product", productId, undefined, { ids }, tx);
  });
  return listMedia(productId);
}
