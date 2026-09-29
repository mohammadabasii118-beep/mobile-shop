"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "./guard";
import { customBlockSchema } from "@/lib/validation";

export async function toggleSection(id: string, isActive: boolean) {
  await requireAdmin();
  await db.homepageSection.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/homepage");
  revalidatePath("/");
}

export async function reorderSection(id: string, order: number) {
  await requireAdmin();
  await db.homepageSection.update({ where: { id }, data: { order } });
  revalidatePath("/admin/homepage");
  revalidatePath("/");
}

// The "page builder" part of the homepage manager: a CUSTOM_BLOCK section
// an admin creates and fills in themselves, stored in the section's
// generic `config` JSON column — no schema change needed per block.
function parseCustomBlockForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const data = customBlockSchema.parse(raw);
  return {
    title: data.title,
    body: data.body || "",
    imageUrl: data.imageUrl || "",
    linkUrl: data.linkUrl || "",
    linkLabel: data.linkLabel || "",
  };
}

export async function createCustomBlock(formData: FormData) {
  await requireAdmin();
  const config = parseCustomBlockForm(formData);
  const maxOrder = await db.homepageSection.aggregate({ _max: { order: true } });
  await db.homepageSection.create({
    data: {
      type: "CUSTOM_BLOCK",
      title: config.title,
      order: (maxOrder._max.order ?? 0) + 1,
      isActive: true,
      config,
    },
  });
  revalidatePath("/admin/homepage");
  revalidatePath("/");
}

export async function updateCustomBlock(id: string, formData: FormData) {
  await requireAdmin();
  const config = parseCustomBlockForm(formData);
  await db.homepageSection.update({ where: { id }, data: { title: config.title, config } });
  revalidatePath("/admin/homepage");
  revalidatePath("/");
}

export async function deleteCustomBlock(id: string) {
  await requireAdmin();
  // Only ever deletes a CUSTOM_BLOCK — the built-in section types (HERO,
  // CATEGORY_STRIP, etc.) are fixed parts of the homepage and can only be
  // reordered/toggled, never removed, so this is scoped by type as a
  // second guard against accidentally deleting one of those by a stale id.
  await db.homepageSection.deleteMany({ where: { id, type: "CUSTOM_BLOCK" } });
  revalidatePath("/admin/homepage");
  revalidatePath("/");
}

export async function saveBanner(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const title = formData.get("title") as string;
  const subtitle = formData.get("subtitle") as string;
  const linkUrl = formData.get("linkUrl") as string;
  const isActive = formData.get("isActive") === "on";
  if (id) {
    await db.banner.update({ where: { id }, data: { title, subtitle, linkUrl, isActive } });
  } else {
    await db.banner.create({ data: { title, subtitle, linkUrl, isActive, order: 0 } });
  }
  revalidatePath("/admin/homepage");
  revalidatePath("/");
}
