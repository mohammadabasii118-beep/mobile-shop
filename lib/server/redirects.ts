import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

export type SlugKind = "product" | "category" | "brand" | "model" | "post";

/** Remember the old URL of an entity whose slug was changed, so it keeps answering with a permanent redirect. */
export async function recordSlugChange(tx: Prisma.TransactionClient, kind: SlugKind, oldSlug: string, newSlug: string) {
  if (!oldSlug || oldSlug === newSlug) return;
  await tx.slugRedirect.deleteMany({ where: { kind, oldSlug: newSlug } }); // avoid loops when a slug is reused
  await tx.slugRedirect.upsert({ where: { kind_oldSlug: { kind, oldSlug } }, update: { newSlug }, create: { kind, oldSlug, newSlug } });
  // Older redirects that pointed at the previous slug now point straight to the newest one (no chains).
  await tx.slugRedirect.updateMany({ where: { kind, newSlug: oldSlug }, data: { newSlug } });
}

export async function resolveSlugRedirect(kind: SlugKind, slug: string): Promise<string | null> {
  return (await db.slugRedirect.findUnique({ where: { kind_oldSlug: { kind, oldSlug: slug } } }))?.newSlug ?? null;
}
