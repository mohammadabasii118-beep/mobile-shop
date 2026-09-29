"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { categorySchema } from "@/lib/validation";
import { requireAdmin } from "./guard";

function parseForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return categorySchema.parse(raw);
}

export async function createCategory(formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);
  await db.category.create({
    data: { name: data.name, slug: data.slug, parentId: data.parentId || null, imageUrl: data.imageUrl || null, order: data.order, isActive: !!data.isActive },
  });
  revalidatePath("/admin/categories");
  revalidatePath("/");
  redirect("/admin/categories");
}

export async function updateCategory(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);
  await db.category.update({
    where: { id },
    data: { name: data.name, slug: data.slug, parentId: data.parentId || null, imageUrl: data.imageUrl || null, order: data.order, isActive: !!data.isActive },
  });
  revalidatePath("/admin/categories");
  revalidatePath("/");
  redirect("/admin/categories");
}

export async function deleteCategory(id: string) {
  await requireAdmin();
  await db.category.delete({ where: { id } });
  revalidatePath("/admin/categories");
  revalidatePath("/");
}
