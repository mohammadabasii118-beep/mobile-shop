import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ReadyPost, TelegramPost } from "@/types";

// Minimal file persistence until PostgreSQL is wired in: keeps received posts, the "ready to post" queue
// and the polling offset across restarts.
const DIR = join(process.cwd(), ".data");
const FILE = join(DIR, "telegram.json");

export interface TelegramState { offset: number; posts: TelegramPost[]; ready: ReadyPost[] }

// Always read from disk: the poller (instrumentation bundle) and API routes are separate bundles, so a module-level cache would go stale.
export function loadTelegramState(): TelegramState {
  try {
    const s = JSON.parse(readFileSync(FILE, "utf8")) as Partial<TelegramState>;
    return { offset: s.offset ?? 0, posts: s.posts ?? [], ready: s.ready ?? [] };
  } catch {
    return { offset: 0, posts: [], ready: [] };
  }
}

/** Merge a partial update into the saved state and write it atomically. */
export function saveTelegramState(patch: Partial<TelegramState>) {
  const next = { ...loadTelegramState(), ...patch };
  next.posts = next.posts.slice(0, 200);
  next.ready = next.ready.slice(0, 200);
  try {
    mkdirSync(DIR, { recursive: true });
    const tmp = `${FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(next));
    renameSync(tmp, FILE);
  } catch (e) {
    console.error("[storage] could not persist state:", (e as Error).message);
  }
}
