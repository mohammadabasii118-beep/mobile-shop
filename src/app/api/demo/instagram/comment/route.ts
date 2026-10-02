import { api } from "@/lib/api";
import { simulateComment } from "@/services/automation";

export const POST = api(async () => (await simulateComment()).run, { role: "editor", limit: 30 });
