/**
 * First-time production setup. Safe to re-run; never deletes data and never creates demo content.
 *   BOOTSTRAP_ADMIN_PHONE=09xxxxxxxxx BOOTSTRAP_ADMIN_PASSWORD='…' npm run bootstrap:prod
 * Creates roles/permissions, the first super admin, and marks the database as a production instance
 * (which makes the demo seed refuse to run against it).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { syncRbac } from "../prisma/rbac";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const phone = process.env.BOOTSTRAP_ADMIN_PHONE ?? "";
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
  if (!/^09\d{9}$/.test(phone)) throw new Error("BOOTSTRAP_ADMIN_PHONE must be an Iranian mobile number like 09123456789.");
  if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be ≥12 characters with upper, lower and a digit.");
  if (/^0912000000\d$/.test(phone)) throw new Error("Demo phone numbers are not allowed on a production instance.");
  await syncRbac(db);
  const role = await db.role.findUniqueOrThrow({ where: { key: "super_admin" } });
  const customer = await db.role.findUniqueOrThrow({ where: { key: "customer" } });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.upsert({ where: { phone }, update: { passwordHash, isActive: true }, create: { phone, passwordHash, firstName: "مدیر", lastName: "ارشد", displayName: "مدیر ارشد", phoneVerifiedAt: new Date() } });
  for (const r of [role, customer]) await db.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: r.id } }, update: {}, create: { userId: user.id, roleId: r.id } });
  await db.siteSetting.upsert({ where: { key: "instance" }, update: { value: { mode: "production" } }, create: { key: "instance", value: { mode: "production" } } });
  const demo = await db.user.count({ where: { phone: { startsWith: "0912000000" } } });
  console.log(`Bootstrap OK. Super admin: ${phone}. Instance marked "production".`);
  if (demo > 0) console.warn(`WARNING: ${demo} demo account(s) (0912000000x) exist in this database. Deactivate/delete them before going live.`);
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); }).finally(() => db.$disconnect());
