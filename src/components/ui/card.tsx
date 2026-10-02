import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/provider";

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 rounded-xl border bg-card shadow-sm", className)} {...p} />;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  const t = useT();
  return (
    <div className={cn("flex items-start justify-between gap-3 p-5 pb-3", className)}>
      <div>
        <h3 className="text-sm font-semibold">{typeof title === "string" ? t(title) : title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{typeof description === "string" ? t(description) : description}</p>}
      </div>
      {action}
    </div>
  );
}
