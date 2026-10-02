import type { LucideIcon } from "lucide-react";
import { useT } from "@/i18n/provider";

export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description?: string }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <div className="rounded-full bg-muted p-3"><Icon className="size-6 text-muted-foreground" /></div>
      <p className="font-medium">{t(title)}</p>
      {description && <p className="max-w-xs text-sm text-muted-foreground">{t(description)}</p>}
    </div>
  );
}
