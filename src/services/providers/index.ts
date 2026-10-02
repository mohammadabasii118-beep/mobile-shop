import { MockAIProvider } from "./mock/ai";
import { MockInstagramProvider } from "./mock/instagram";
import { telegramConfig } from "@/config/telegram";
import { LiveTelegramProvider } from "./live/telegram";
import { MockTelegramProvider } from "./mock/telegram";
import type { Providers } from "./types";

let cached: Providers | undefined;

/**
 * Provider registry, per provider: Telegram is LIVE when TELEGRAM_BOT_TOKEN + TELEGRAM_CHANNEL are set,
 * Instagram and AI are still mocks. Add InstagramGraphProvider / OpenAIProvider here when they are ready.
 */
export function getProviders(): Providers {
  return (cached ??= {
    telegram: telegramConfig().live ? new LiveTelegramProvider() : new MockTelegramProvider(),
    instagram: new MockInstagramProvider(),
    ai: new MockAIProvider(),
  });
}
