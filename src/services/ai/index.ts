import { getDb } from "@/database/store";
import { getProviders } from "@/services/providers";
import type { AISettings } from "@/types";

export const getAiSettings = () => getDb().aiSettings;

export function updateAiSettings(patch: Partial<AISettings>) {
  Object.assign(getDb().aiSettings, patch);
  return getDb().aiSettings;
}

export async function aiReply(text: string) {
  const db = getDb();
  return getProviders().ai.reply({ text, products: db.products, settings: db.aiSettings });
}
