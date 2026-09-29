import { db } from "@/lib/db";
import { parseJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth/guard";
import { addressSchema } from "@/lib/server/validation";

// Every query below is scoped by userId, so one user can never read or change another user's addresses.
export const GET = route(async () => {
  const u = await requireUser();
  return db.address.findMany({ where: { userId: u.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
});

export const POST = route(async (req) => {
  const u = await requireUser();
  const data = await parseJson(req, addressSchema);
  const count = await db.address.count({ where: { userId: u.id } });
  if (count >= 10) throw new (await import("@/lib/server/errors")).AppError(409, "too_many_addresses", "حداکثر ۱۰ آدرس می‌توانید ذخیره کنید.");
  return db.$transaction(async (tx) => {
    const makeDefault = data.isDefault || count === 0;
    if (makeDefault) await tx.address.updateMany({ where: { userId: u.id }, data: { isDefault: false } });
    return tx.address.create({ data: { ...data, postalCode: data.postalCode || null, isDefault: makeDefault, userId: u.id } });
  });
});
