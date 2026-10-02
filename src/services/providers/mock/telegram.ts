import { getDb } from "@/database/store";
import type { TelegramProvider } from "../types";

export class MockTelegramProvider implements TelegramProvider {
  async getChannel() {
    return getDb().channel;
  }
  async listPosts() {
    return [...getDb().telegramPosts].sort((a, b) => b.date.localeCompare(a.date));
  }
}
