import { api } from "@/lib/api";
import { simulateNewCustomer } from "@/services/automation";

export const POST = api(async () => (await simulateNewCustomer()).run, { role: "editor", limit: 30 });
