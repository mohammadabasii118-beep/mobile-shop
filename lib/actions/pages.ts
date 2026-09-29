"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "./guard";
import { pageSchema } from "@/lib/validation";

function parseForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return pageSchema.parse(raw);
}

export async function createPage(formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);
  await db.page.create({
    data: { slug: data.slug, title: data.title, body: data.body, isPublished: !!data.isPublished },
  });
  revalidatePath("/admin/pages");
  redirect("/admin/pages");
}

export async function updatePage(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);
  await db.page.update({
    where: { id },
    data: { slug: data.slug, title: data.title, body: data.body, isPublished: !!data.isPublished },
  });
  revalidatePath("/admin/pages");
  revalidatePath(`/page/${data.slug}`);
  redirect("/admin/pages");
}

export async function deletePage(id: string) {
  await requireAdmin();
  await db.page.delete({ where: { id } });
  revalidatePath("/admin/pages");
}
