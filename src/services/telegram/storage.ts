import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TelegramPost } from "@/types";

// Minimal file persistence until PostgreSQL is wired in: keeps received posts + the polling offset across restarts.
const DIR = join(process.cwd(), ".data");
const FILE = join(DIR, "telegram.json");

export interface TelegramState { offset: number; posts: TelegramPost[] }

export function loadTelegramState(): TelegramState {
  try {
    const s = JSON.parse(readFileSync(FILE, "utf8")) as TelegramState;
    return { offset: s.offset ?? 0, posts: s.posts ?? [] };
  } catch {
    return { offset: 0, posts: [] };
  }
}

export function saveTelegramState(state: TelegramState) {
  try {
    mkdirSync(DIR, { recursive: true });
    const tmp = `${FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify({ offset: state.offset, posts: state.posts.slice(0, 200) }));
    renameSync(tmp, FILE);
  } catch (e) {
    console.error("[telegram] could not persist state:", (e as Error).message);
  }
}
