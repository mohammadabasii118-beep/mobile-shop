"use client";
import { AlertTriangle, Bell, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { useAction, useNotifications, apiFetch } from "@/hooks/api";
import { useFmt } from "@/hooks/use-fmt";
import { useT } from "@/i18n/provider";

const ICON = {
  success: <CheckCircle2 className="size-4 shrink-0 text-success" />,
  warning: <AlertTriangle className="size-4 shrink-0 text-warning" />,
  info: <Info className="size-4 shrink-0 text-info" />,
};

export function NotificationCenter() {
  const { data = [] } = useNotifications();
  const { timeAgo } = useFmt();
  const t = useT();
  const markRead = useAction(() => apiFetch("/api/notifications", { method: "PATCH" }));
  const unread = data.filter((n) => !n.read).length;
  return (
    <Dropdown
      className="w-80"
      trigger={
        <Button variant="ghost" size="icon" aria-label={t("Notifications")} className="relative">
          <Bell className="size-4" />
          {unread > 0 && <span className="absolute top-1 end-1 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
        </Button>
      }
    >
      {() => (
        <div>
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-sm font-semibold">{t("Notifications")}</p>
            {unread > 0 && <button onClick={() => markRead.mutate()} className="text-xs text-primary hover:underline">{t("Mark all read")}</button>}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {data.slice(0, 12).map((n) => (
              <li key={n.id} className="flex gap-2.5 rounded-lg px-3 py-2.5 hover:bg-muted">
                {ICON[n.level]}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.read ? "text-muted-foreground" : "font-medium"}`}>{t(n.title)}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(n.at)}</p>
                </div>
                {!n.read && <span className="mt-1.5 size-2 rounded-full bg-primary" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dropdown>
  );
}
