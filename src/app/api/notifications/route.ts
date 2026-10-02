import { api } from "@/lib/api";
import { listNotifications, markNotificationsRead } from "@/services/activity";

export const GET = api(() => listNotifications());
export const PATCH = api(() => { markNotificationsRead(); return { ok: true }; });
