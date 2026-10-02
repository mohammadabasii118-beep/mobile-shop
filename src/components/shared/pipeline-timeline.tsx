import { AlertTriangle, CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatTime } from "@/utils/format";
import type { PipelineStep } from "@/types";

const ICON = {
  success: <CheckCircle2 className="size-5 text-success" />,
  warning: <AlertTriangle className="size-5 text-warning" />,
  error: <XCircle className="size-5 text-danger" />,
  running: <Loader2 className="size-5 animate-spin text-primary" />,
  pending: <Circle className="size-5 text-border" />,
};

/** Visual vertical timeline. `visible` lets the caller reveal steps progressively for the animation. */
export function PipelineTimeline({ steps, visible = steps.length, running }: { steps: PipelineStep[]; visible?: number; running?: boolean }) {
  const shown = steps.slice(0, visible);
  return (
    <ol className="space-y-0">
      {shown.map((s, i) => {
        const last = i === shown.length - 1 && !running && visible >= steps.length;
        return (
          <li key={`${s.key}-${i}`} className="animate-step-in flex gap-3">
            <div className="flex flex-col items-center">
              {ICON[s.status]}
              {!last && <div className="my-1 w-px flex-1 bg-border" />}
            </div>
            <div className="pb-4">
              <p className="text-sm leading-5 font-medium">{s.label}</p>
              {s.detail && <p dir="auto" className="mt-0.5 max-w-sm text-xs text-muted-foreground">{s.detail}</p>}
              <p className="mt-0.5 text-[11px] text-muted-foreground/70">{formatTime(s.at)}</p>
            </div>
          </li>
        );
      })}
      {running && (
        <li className="flex gap-3">{ICON.running}<p className="text-sm text-muted-foreground">Processing…</p></li>
      )}
    </ol>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${value}%` }} />
    </div>
  );
}
