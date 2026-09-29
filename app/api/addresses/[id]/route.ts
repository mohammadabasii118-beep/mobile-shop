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
  const res = await db.address.updateMany({ where: { id, userId: u.id }, data: { ...data, postalCode: data.postalCode || null } });
  if (res.count !== 1) throw notFound("آدرس پیدا نشد.");
  return db.address.findUnique({ where: { id } });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const u = await requireUser();
  const res = await db.address.deleteMany({ where: { id: (await params).id, userId: u.id } });
  if (res.count !== 1) throw notFound("آدرس پیدا نشد.");
  return { deleted: true };
});
