import { DEMO_MODE } from "@/config/app";
import { MockAIProvider } from "./mock/ai";
import { MockInstagramProvider } from "./mock/instagram";
import { MockTelegramProvider } from "./mock/telegram";
import type { Providers } from "./types";

let cached: Providers | undefined;

/**
 * Provider registry. In DEMO_MODE the mocks are used.
 * Live mode: add TelegramBotProvider / InstagramGraphProvider / OpenAIProvider and return them here.
 */
export function getProviders(): Providers {
  if (!DEMO_MODE) {
    throw new Error("Real providers are not implemented yet. Set DEMO_MODE=true.");
  }
  return (cached ??= {
    telegram: new MockTelegramProvider(),
    instagram: new MockInstagramProvider(),
    ai: new MockAIProvider(),
  });
}
