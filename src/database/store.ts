import { telegramConfig } from "@/config/telegram";
import { loadTelegramState } from "@/services/telegram/storage";
import { buildSeed, type SeedData } from "./seed";

/**
 * In-memory demo database. Same entity shapes as prisma/schema.prisma.
 * To go live, replace `db` with Prisma-backed repositories — services only talk to this object.
 */
export interface TelegramLiveStatus { enabled: boolean; lastPollAt?: string; error?: string }
type Store = SeedData & { seq: number; telegramLive: TelegramLiveStatus };

const g = globalThis as unknown as { __smStore?: Store };

function create(): Store {
  const seed = buildSeed();
  const cfg = telegramConfig();
  if (cfg.live) {
    // Live Telegram: drop the demo posts/channel; real ones arrive from the poller (and are restored from disk).
    seed.telegramPosts = loadTelegramState().posts;
    seed.channel = { name: cfg.channel, username: cfg.channel, status: "disconnected", members: 0 };
  }
  return { ...seed, seq: 1000, telegramLive: { enabled: cfg.live } };
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
