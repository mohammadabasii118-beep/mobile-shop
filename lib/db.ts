import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create() {
  // One pool per process. DB_POOL_MAX (default 10) must stay below PostgreSQL's max_connections / number of app processes.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  const client = new PrismaClient(process.env.DB_QUERY_LOG === "1" ? { adapter, log: [{ emit: "event", level: "query" }] } : { adapter });
  if (process.env.DB_QUERY_LOG === "1") (client as unknown as { $on: (e: string, f: (q: { query: string; duration: number }) => void) => void }).$on("query", (q) => console.info(`[db] ${q.duration}ms ${q.query.slice(0, 120).replace(/\s+/g, " ")}`));
  return client;
}

// Kept on globalThis in every environment: Next can load this module once per route bundle, and each copy would open its own pool.
export const db = globalForPrisma.prisma ?? (globalForPrisma.prisma = create());
