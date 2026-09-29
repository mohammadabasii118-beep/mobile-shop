"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { wholesaleTierSchema } from "@/lib/validation";
import { requireAdmin } from "./guard";

function parseForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return wholesaleTierSchema.parse(raw);
}

export async function createWholesaleTier(formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);
  const existing = await db.wholesaleTier.findUnique({ where: { minQuantity: data.minQuantity } });
  if (existing) throw new Error("قبلاً یک پله برای همین تعداد ثبت شده است");
  await db.wholesaleTier.create({ data: { ...data, isActive: data.isActive ?? true } });
  revalidatePath("/admin/wholesale-tiers");
  redirect("/admin/wholesale-tiers");
}

export async function updateWholesaleTier(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);
  await db.wholesaleTier.update({ where: { id }, data: { ...data, isActive: data.isActive ?? true } });
  revalidatePath("/admin/wholesale-tiers");
  redirect("/admin/wholesale-tiers");
}

export async function deleteWholesaleTier(id: string) {
  await requireAdmin();
  await db.wholesaleTier.delete({ where: { id } });
  revalidatePath("/admin/wholesale-tiers");
}
