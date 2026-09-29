import { db } from "@/lib/db";

// Same lazily-created singleton pattern as lib/bankSettings.ts — created on
// first read with safe defaults, editable right away from /admin/settings.
export async function getSiteSettings() {
  const existing = await db.siteSettings.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  // upsert: parallel first requests on an empty DB must not race on the unique id.
  return db.siteSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
}
