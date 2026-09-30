import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + database readiness for load balancers / uptime monitors. Exposes no configuration or data. */
export async function GET() {
  const t = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "up", ms: Date.now() - t }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "degraded", db: "down" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
