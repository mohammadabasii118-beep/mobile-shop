"use client";
import Link from "next/link";
import { ArrowLeft, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { DataTable, type Column } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { apiFetch, useAction, useAutomation } from "@/hooks/api";
import { useSimulation } from "@/modules/simulation/simulation-provider";
import { formatDateTime, timeAgo } from "@/utils/format";
import type { AutomationExecution } from "@/types";
import { Workflow } from "./workflow";

const columns: Column<AutomationExecution>[] = [
  { key: "when", label: "Started", primary: true, cell: (e) => formatDateTime(e.startedAt) },
  { key: "status", label: "Status", cell: (e) => <StatusBadge status={e.status} /> },
  { key: "dur", label: "Duration", cell: (e) => `${(e.durationMs / 1000).toFixed(1)}s` },
  { key: "sum", label: "Summary", cell: (e) => e.summary },
];

export function AutomationDetailPage({ id }: { id: string }) {
  const { data } = useAutomation(id);
  const { runAutomation, busy } = useSimulation();
  const toggle = useAction((status: "active" | "paused") => apiFetch(`/api/automations/${id}`, { method: "PATCH", json: { status } }));
  const a = data?.automation;
  return (
    <div>
      <Link href="/automations" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Automations</Link>
      {!a ? <Skeleton className="h-96" /> : (
        <>
          <PageHeader title={a.name} description={a.description} actions={<>
            <span className="flex items-center gap-2 text-sm"><Switch checked={a.status === "active"} label="Toggle" onChange={(v) => toggle.mutate(v ? "active" : "paused", { onSuccess: () => toast.success(v ? "Enabled" : "Paused") })} /><StatusBadge status={a.status} /></span>
            <Button onClick={() => runAutomation(a.id, a.name)} disabled={busy}><Play className="size-4" />Simulate Automation</Button>
          </>} />
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {[["Total runs", String(a.runs)], ["Success rate", `${a.successRate}%`], ["Last run", a.lastRun ? timeAgo(a.lastRun) : "—"]].map(([k, v]) => (
              <Card key={k} className="p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="text-2xl font-semibold">{v}</p></Card>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardHeader title="Workflow" description="Visual flow of this automation" /><div className="p-5 pt-2"><Workflow steps={a.steps} /></div></Card>
            <Card><CardHeader title="Recent executions" /><DataTable columns={columns} rows={data.executions} rowKey={(e) => e.id} /></Card>
          </div>
        </>
      )}
    </div>
  );
}
