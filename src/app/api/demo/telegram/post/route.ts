import { api } from "@/lib/api";
import { simulateTelegramPost } from "@/services/automation";

export const POST = api(async () => (await simulateTelegramPost()).run, { role: "editor", limit: 30 });
