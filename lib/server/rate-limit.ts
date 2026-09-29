import { db } from "@/lib/db";
import { tooMany } from "@/lib/server/errors";

/**
 * Fixed-window counter stored in PostgreSQL (atomic upsert), so limits hold across
 * multiple app instances on a VPS. Throws 429 when the limit is exceeded.
 */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSec}::double precision))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < now() THEN now() + make_interval(secs => ${windowSec}::double precision) ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0]!;
  if (row.count > limit) throw tooMany(Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000)));
}
