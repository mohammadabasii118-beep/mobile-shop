import { api } from "@/lib/api";
import { simulateDirectMessage } from "@/services/automation";

export const POST = api(async () => (await simulateDirectMessage()).run, { role: "editor", limit: 30 });
