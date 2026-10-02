import { AlertTriangle, Bot, Camera, CheckCircle2, MessageCircle, MessagesSquare, Send, UserPlus, Workflow, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useFmt } from "@/hooks/use-fmt";
import { useT } from "@/i18n/provider";
import type { ActivityLog } from "@/types";

export function logIcon(type: string): LucideIcon {
  if (type.startsWith("telegram")) return Send;
  if (type.startsWith("ai")) return Bot;
  if (type === "instagram.comment") return MessageCircle;
  if (type === "instagram.dm") return MessagesSquare;
  if (type.startsWith("instagram")) return Camera;
  if (type.startsWith("customer")) return UserPlus;
  if (type.startsWith("automation") || type.startsWith("demo")) return Workflow;
  return CheckCircle2;
}

const TONE = { success: "bg-success/12 text-success", info: "bg-info/12 text-info", warning: "bg-warning/15 text-warning", error: "bg-danger/12 text-danger" };

export function ActivityFeed({ items }: { items: ActivityLog[] }) {
  const { timeAgo } = useFmt();
  const t = useT();
  return (
    <ul className="divide-y">
      {items.map((l) => {
        const Icon = l.status === "warning" ? AlertTriangle : l.status === "error" ? XCircle : logIcon(l.type);
        return (
          <li key={l.id} className="flex items-center gap-3 px-5 py-3">
            <span className={cn("rounded-lg p-2", TONE[l.status])}><Icon className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t(l.title)}</p>
              <p dir="auto" className="truncate text-xs text-muted-foreground">{l.details}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(l.at)}</span>
          </li>
        );
      })}
    </ul>
  );
}
