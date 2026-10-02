import { nextId } from "@/database/store";
import { logActivity } from "@/services/activity";
import type { LogLevel, PipelineRun, PipelineStep, StepStatus } from "@/types";

/** Collects visible steps for the UI timeline and mirrors each one into the activity log. */
export class Pipeline {
  readonly steps: PipelineStep[] = [];
  constructor(private title: string, private logType: string) {}

  step(key: string, label: string, detail = "", status: StepStatus = "success") {
    this.steps.push({ key, label, detail, status, at: new Date().toISOString() });
    const level: LogLevel = status === "error" ? "error" : status === "warning" ? "warning" : "success";
    logActivity(this.logType, level, label, detail);
  }

  get ok() {
    return !this.steps.some((s) => s.status === "error");
  }

  toRun(): PipelineRun {
    return { id: nextId("run"), title: this.title, ok: this.ok, steps: this.steps };
  }
}
