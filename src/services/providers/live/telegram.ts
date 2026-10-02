import { getDb } from "@/database/store";
import type { TelegramProvider } from "../types";

/** Live provider: the poller keeps channel info and posts fresh in the store. */
export class LiveTelegramProvider implements TelegramProvider {
  async getChannel() {
    return getDb().channel;
  }
  async listPosts() {
    return [...getDb().telegramPosts].sort((a, b) => b.date.localeCompare(a.date));
  }
}
