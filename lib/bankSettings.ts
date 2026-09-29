import { db } from "@/lib/db";

export async function getBankSettings() {
  const existing = await db.bankCardSettings.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  // Created lazily on first read with sensible placeholder defaults, editable
  // right away from /admin/settings — no manual DB seeding required.
  return db.bankCardSettings.create({ data: { id: "singleton" } });
}
