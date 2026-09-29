"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { brandSchema, phoneModelSchema, colorSchema } from "@/lib/validation";
import { requireAdmin } from "./guard";

// ---------- Brand ----------

export async function createBrand(formData: FormData) {
  await requireAdmin();
  const data = brandSchema.parse(Object.fromEntries(formData.entries()));
  await db.brand.create({ data });
  revalidatePath("/admin/attributes/brands");
  redirect("/admin/attributes/brands");
}

export async function updateBrand(id: string, formData: FormData) {
  await requireAdmin();
  const data = brandSchema.parse(Object.fromEntries(formData.entries()));
  await db.brand.update({ where: { id }, data });
  revalidatePath("/admin/attributes/brands");
  redirect("/admin/attributes/brands");
}

export async function deleteBrand(id: string) {
  await requireAdmin();
  await db.brand.delete({ where: { id } });
  revalidatePath("/admin/attributes/brands");
}

// ---------- PhoneModel ----------

export async function createPhoneModel(formData: FormData) {
  await requireAdmin();
  const data = phoneModelSchema.parse(Object.fromEntries(formData.entries()));
  await db.phoneModel.create({ data });
  revalidatePath("/admin/attributes/models");
  redirect("/admin/attributes/models");
}

export async function updatePhoneModel(id: string, formData: FormData) {
  await requireAdmin();
  const data = phoneModelSchema.parse(Object.fromEntries(formData.entries()));
  await db.phoneModel.update({ where: { id }, data });
  revalidatePath("/admin/attributes/models");
  redirect("/admin/attributes/models");
}

export async function deletePhoneModel(id: string) {
  await requireAdmin();
  await db.phoneModel.delete({ where: { id } });
  revalidatePath("/admin/attributes/models");
}

// ---------- Color ----------

export async function createColor(formData: FormData) {
  await requireAdmin();
  const raw = colorSchema.parse(Object.fromEntries(formData.entries()));
  await db.color.create({ data: { name: raw.name, slug: raw.slug, hexCode: raw.hexCode || null } });
  revalidatePath("/admin/attributes/colors");
  redirect("/admin/attributes/colors");
}

export async function updateColor(id: string, formData: FormData) {
  await requireAdmin();
  const raw = colorSchema.parse(Object.fromEntries(formData.entries()));
  await db.color.update({ where: { id }, data: { name: raw.name, slug: raw.slug, hexCode: raw.hexCode || null } });
  revalidatePath("/admin/attributes/colors");
  redirect("/admin/attributes/colors");
}

export async function deleteColor(id: string) {
  await requireAdmin();
  await db.color.delete({ where: { id } });
  revalidatePath("/admin/attributes/colors");
}
