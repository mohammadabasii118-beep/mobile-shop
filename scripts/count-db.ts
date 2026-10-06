/** Import FIRST in a test: pre-seeds the app's `db` singleton (lib/db) with a client that records every SQL statement. */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

export const logged: string[] = [];
const counting = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }), log: [{ emit: "event", level: "query" }] });
(counting as unknown as { $on: (e: string, f: (q: { query: string }) => void) => void }).$on("query", (q) => logged.push(q.query));
(globalThis as unknown as { prisma?: unknown }).prisma = counting;
