/** Read-only production readiness check: `npm run preflight`. Exits 1 on any blocking problem. Changes nothing. */
import "dotenv/config";
import { existsSync, statSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const bad: string[] = [], warn: string[] = [];
const e = process.env;
async function main() {
  if (!e.DATABASE_URL) bad.push("DATABASE_URL missing");
  if (!e.AUTH_SECRET || e.AUTH_SECRET.length < 32) bad.push("AUTH_SECRET missing or shorter than 32 chars");
  else if (/^(change|replace|secret|dev|test|example)/i.test(e.AUTH_SECRET) || new Set(e.AUTH_SECRET).size < 10) bad.push("AUTH_SECRET looks like a placeholder");
  if (!(e.APP_URL ?? "").startsWith("https://")) bad.push("APP_URL must be https:// (cookies Secure, HSTS)");
  if (e.TRUST_PROXY !== "1") warn.push("TRUST_PROXY is not 1 — behind nginx/Caddy set it to 1, otherwise per-IP rate limits see one shared address");
  if (e.SMS_PROVIDER === "console" || !e.SMS_PROVIDER) warn.push("SMS_PROVIDER=console: OTP codes are printed to logs and never reach users — a real SMS provider is required for login by OTP");
  const dir = e.UPLOAD_DIR ?? "./storage";
  if (!existsSync(dir) || !statSync(dir).isDirectory()) warn.push(`UPLOAD_DIR ${dir} does not exist yet (created on first upload; make sure it is writable and backed up)`);
  if (e.NODE_ENV !== "production") warn.push("NODE_ENV is not production");
  if (e.DATABASE_URL) {
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: e.DATABASE_URL }) });
    try {
      const pending = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`;
      if (pending[0]!.n > 0) bad.push(`${pending[0]!.n} unfinished migration(s)`);
      const marker = await db.siteSetting.findUnique({ where: { key: "instance" } });
      if ((marker?.value as { mode?: string } | null)?.mode !== "production") warn.push('database is not marked as a production instance — run `npm run bootstrap:prod`');
      const demo = await db.user.count({ where: { phone: { startsWith: "0912000000" } } });
      if (demo) bad.push(`${demo} demo account(s) (0912000000x) with known passwords exist`);
      const supers = await db.user.count({ where: { isActive: true, roles: { some: { role: { key: "super_admin" } } } } });
      if (!supers) bad.push("no active super_admin exists");
    } catch (err) { bad.push("database check failed: " + (err as Error).message.split("\n")[0]); }
    finally { await db.$disconnect(); }
  }
  for (const w of warn) console.warn("WARN ", w);
  for (const b of bad) console.error("FAIL ", b);
  console.log(bad.length ? `\nNOT READY: ${bad.length} blocking problem(s).` : `\nReady (${warn.length} warning(s)).`);
  process.exit(bad.length ? 1 : 0);
}
main();
