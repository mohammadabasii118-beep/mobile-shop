import { db } from "@/lib/db";
import { parseJson, route } from "@/lib/server/http";
import { notFound } from "@/lib/server/errors";
import { requireUser } from "@/lib/server/auth/guard";
import { addressSchema } from "@/lib/server/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  const data = await parseJson(req, addressSchema);
  return db.$transaction(async (tx) => {
    const own = await tx.address.findFirst({ where: { id, userId: u.id }, select: { isDefault: true } });
    if (!own) throw notFound("آدرس پیدا نشد.");
    // Exactly one default: choosing this one clears the others; un-ticking the current default simply keeps it (a default always exists).
    const makeDefault = data.isDefault === true;
    if (makeDefault) await tx.address.updateMany({ where: { userId: u.id, id: { not: id } }, data: { isDefault: false } });
    return tx.address.update({ where: { id }, data: { ...data, postalCode: data.postalCode || null, isDefault: makeDefault || own.isDefault } });
  });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const u = await requireUser();
  const id = (await params).id;
  return db.$transaction(async (tx) => {
    const own = await tx.address.findFirst({ where: { id, userId: u.id }, select: { isDefault: true } });
    if (!own) throw notFound("آدرس پیدا نشد.");
    await tx.address.delete({ where: { id } });
    // Deleting the default promotes the newest remaining address.
    if (own.isDefault) { const next = await tx.address.findFirst({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, select: { id: true } }); if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } }); }
    return { deleted: true };
  });
});
