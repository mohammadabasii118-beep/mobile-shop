import { buildSeed, type SeedData } from "./seed";

/**
 * In-memory demo database. Same entity shapes as prisma/schema.prisma.
 * To go live, replace `db` with Prisma-backed repositories — services only talk to this object.
 */
type Store = SeedData & { seq: number };

const g = globalThis as unknown as { __smStore?: Store };

function create(): Store {
  return { ...buildSeed(), seq: 1000 };
}

export function getDb(): Store {
  return (g.__smStore ??= create());
}

export function resetDb() {
  g.__smStore = create();
  return g.__smStore;
}

export function nextId(prefix: string) {
  return `${prefix}${++getDb().seq}`;
}
