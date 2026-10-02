import { api } from "@/lib/api";
import { getOptions, listAutomations } from "@/services/automation";

export const GET = api(() => ({ automations: listAutomations(), options: getOptions() }));
