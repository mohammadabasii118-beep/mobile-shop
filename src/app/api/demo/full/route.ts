import { api } from "@/lib/api";
import { runFullDemo } from "@/services/automation";

export const POST = api(() => runFullDemo(), { role: "editor", limit: 20 });
