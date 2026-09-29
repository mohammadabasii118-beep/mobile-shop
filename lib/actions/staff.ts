"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAdmin } from "./guard";
import { staffCreateSchema, staffPermissionsSchema } from "@/lib/validation";

/** Only a real ADMIN may create a staff account — never self-service. */
export async function createStaffAccount(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const permissions = formData.getAll("permissions").map(String);
  const data = staffCreateSchema.parse({ ...raw, permissions });

  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error("این ایمیل قبلاً ثبت شده است");

  const passwordHash = await bcrypt.hash(data.password, 10);
  await db.user.create({
    data: { name: data.name, email: data.email, passwordHash, role: "STAFF", permissions: data.permissions },
  });

  revalidatePath("/admin/staff");
  redirect("/admin/staff");
}

export async function updateStaffPermissions(userId: string, formData: FormData) {
  await requireAdmin();
  const permissions = formData.getAll("permissions").map(String);
  const data = staffPermissionsSchema.parse({ permissions });
  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target || target.role !== "STAFF") throw new Error("حساب کارمند پیدا نشد");
  await db.user.update({ where: { id: userId }, data: { permissions: data.permissions } });
  revalidatePath("/admin/staff");
}

/** Deletes a STAFF account only — this can never be pointed at an ADMIN
 * or CUSTOMER row, guarded by the same defensive `deleteMany` + `role`
 * pattern used for deleteCustomBlock in Phase 7. */
export async function deleteStaffAccount(userId: string) {
  await requireAdmin();
  await db.user.deleteMany({ where: { id: userId, role: "STAFF" } });
  revalidatePath("/admin/staff");
}
