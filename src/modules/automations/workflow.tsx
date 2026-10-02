import { ArrowDown, Filter, Play, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { AutomationStep } from "@/types";

const STYLE = {
  trigger: { icon: Zap, label: "Trigger", box: "border-primary/40 bg-accent", tone: "primary" as const },
  condition: { icon: Filter, label: "Condition", box: "border-warning/40 bg-warning/10", tone: "warning" as const },
  action: { icon: Play, label: "Action", box: "border-success/40 bg-success/10", tone: "success" as const },
};

export function Workflow({ steps }: { steps: AutomationStep[] }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center">
      {steps.map((s, i) => {
        const st = STYLE[s.kind];
        return (
          <div key={i} className="flex w-full flex-col items-center">
            <div className={cn("w-full rounded-xl border p-4", st.box)}>
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-card p-2 shadow-sm"><st.icon className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <Badge tone={st.tone} className="mb-1">{st.label}</Badge>
                  <p className="text-sm font-medium">{s.label}</p>
                  {s.detail && <p dir="auto" className="text-xs text-muted-foreground">{s.detail}</p>}
                </div>
              </div>
            </div>
            {i < steps.length - 1 && <ArrowDown className="my-1.5 size-5 text-muted-foreground" />}
          </div>
        );
      })}
    </div>
  );
}
