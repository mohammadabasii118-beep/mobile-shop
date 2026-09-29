"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { bankSettingsSchema, siteSettingsSchema } from "@/lib/validation";
import { requireAdmin } from "./guard";

export async function saveBankSettings(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const data = bankSettingsSchema.parse(raw);

  await db.bankCardSettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/checkout");
}

export async function saveSiteSettings(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = siteSettingsSchema.parse(raw);

  // Blank optional text fields are stored as null, not an empty string, so
  // app/layout.tsx's fallback-to-env logic (`settings.siteTitle || ...`)
  // works the same way whether the row was never filled in or was cleared
  // back out by an admin.
  const data = {
    siteTitle: parsed.siteTitle || null,
    siteDescription: parsed.siteDescription || null,
    metaKeywords: parsed.metaKeywords || null,
    instagramUrl: parsed.instagramUrl || null,
    telegramUrl: parsed.telegramUrl || null,
    whatsappUrl: parsed.whatsappUrl || null,
    lowStockThreshold: parsed.lowStockThreshold,
  };

  await db.siteSettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/");
}
