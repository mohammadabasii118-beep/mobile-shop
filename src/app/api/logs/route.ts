import { api } from "@/lib/api";
import { listLogs } from "@/services/activity";

export const GET = api(() => listLogs());
