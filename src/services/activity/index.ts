import { getDb, nextId } from "@/database/store";
import type { ActivityLog, AppNotification } from "@/types";

export function logActivity(type: string, status: ActivityLog["status"], title: string, details = "") {
  const entry: ActivityLog = { id: nextId("l"), at: new Date().toISOString(), type, status, title, details };
  getDb().logs.unshift(entry);
  return entry;
}

export function notify(level: AppNotification["level"], title: string) {
  const n: AppNotification = { id: nextId("n"), level, title, at: new Date().toISOString(), read: false };
  getDb().notifications.unshift(n);
  return n;
}

export const listLogs = () => getDb().logs;
export const listNotifications = () => getDb().notifications;

export function markNotificationsRead() {
  getDb().notifications.forEach((n) => (n.read = true));
}
