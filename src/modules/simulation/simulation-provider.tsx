"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PipelineTimeline, ProgressBar } from "@/components/shared/pipeline-timeline";
import { apiFetch } from "@/hooks/api";
import type { PipelineRun } from "@/types";

export type SimKind = "telegram" | "comment" | "message" | "customer" | "full";
const ENDPOINTS: Record<SimKind, string> = {
  telegram: "/api/demo/telegram/post",
  comment: "/api/demo/instagram/comment",
  message: "/api/demo/instagram/message",
  customer: "/api/demo/customer",
  full: "/api/demo/full",
};
const TITLES: Record<SimKind, string> = {
  telegram: "Simulate New Telegram Post", comment: "Simulate Instagram Comment", message: "Simulate Instagram DM",
  customer: "Simulate New Customer", full: "Full Demo",
};
const STEP_MS = 650;

interface Ctx { simulate: (kind: SimKind) => void; runAutomation: (id: string, name: string) => void; busy: boolean }
const SimCtx = createContext<Ctx | null>(null);
export const useSimulation = () => {
  const c = useContext(SimCtx);
  if (!c) throw new Error("useSimulation outside provider");
  return c;
};

export function SimulationProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [run, setRun] = useState<PipelineRun | null>(null);
  const [visible, setVisible] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => { if (timer.current) clearInterval(timer.current); };
  useEffect(() => stop, []);

  const start = useCallback(async (t: string, url: string, json?: unknown) => {
    stop();
    setTitle(t); setRun(null); setVisible(0); setError(null); setOpen(true);
    try {
      const result = await apiFetch<PipelineRun>(url, { method: "POST", json });
      setRun(result);
      let i = 0;
      timer.current = setInterval(() => {
        i += 1;
        setVisible(i);
        if (i >= result.steps.length) {
          stop();
          qc.invalidateQueries();
          toast[result.ok ? "success" : "warning"](result.ok ? "Completed successfully" : "Completed with warnings");
        }
      }, STEP_MS);
      setVisible(1);
      i = 1;
    } catch (e) {
      setError((e as Error).message);
    }
  }, [qc]);

  const busy = open && !error && (!run || visible < run.steps.length);
  const done = run && visible >= run.steps.length;
  const hasWarn = run?.steps.some((s) => s.status === "warning" || s.status === "error");

  return (
    <SimCtx.Provider value={{
      simulate: (k) => start(TITLES[k], ENDPOINTS[k]),
      runAutomation: (id, name) => start(`Run: ${name}`, "/api/demo/automation/run", { id }),
      busy,
    }}>
      {children}
      <Dialog open={open} onClose={() => { stop(); if (run) qc.invalidateQueries(); setOpen(false); }} title={title} description="Mock event running through the real backend pipeline. No external API is called.">
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : (
          <>
            <ProgressBar value={run ? Math.round((Math.min(visible, run.steps.length) / run.steps.length) * 100) : 5} className="mb-5" />
            {run && <PipelineTimeline steps={run.steps} visible={visible} running={!done} />}
            {done && (
              <div className={`animate-step-in mt-2 flex items-center gap-2 rounded-lg p-3 text-sm font-medium ${hasWarn ? "bg-warning/12 text-warning" : "bg-success/12 text-success"}`}>
                {hasWarn ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
                {hasWarn ? "Finished — some steps need attention" : "✓ Published Successfully"}
              </div>
            )}
          </>
        )}
        <div className="mt-5 flex justify-end">
          <Button variant="outline" onClick={() => { stop(); if (run) qc.invalidateQueries(); setOpen(false); }}>{done ? "Close" : "Skip animation"}</Button>
        </div>
      </Dialog>
    </SimCtx.Provider>
  );
}
