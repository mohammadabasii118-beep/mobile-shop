import { db } from "@/lib/db";

// Same lazily-created singleton pattern as lib/bankSettings.ts — created on
// first read with safe defaults, editable right away from /admin/settings.
export async function getSiteSettings() {
  const existing = await db.siteSettings.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  return db.siteSettings.create({ data: { id: "singleton" } });
}
