import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useFmt } from "@/hooks/use-fmt";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/cn";

export function StatCard({ label, value, icon: Icon, tone = "text-primary bg-accent", hint }: { label: string; value: number; icon: LucideIcon; tone?: string; hint?: string }) {
  const { nf } = useFmt();
  const t = useT();
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className={cn("rounded-xl p-3", tone)}><Icon className="size-5" /></div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{t(label)}</p>
        <p className="text-2xl font-semibold tabular-nums">{nf.format(value)}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{t(hint)}</p>}
      </div>
    </Card>
  );
}
