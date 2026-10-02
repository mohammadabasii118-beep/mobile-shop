"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { DataTable, type Column } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { apiFetch, useAction, useAutomations } from "@/hooks/api";
import { useSimulation } from "@/modules/simulation/simulation-provider";
import { useFmt } from "@/hooks/use-fmt";
import { useT } from "@/i18n/provider";
import type { Automation, TelegramToInstagramOptions } from "@/types";

const OPTION_LABELS: [keyof TelegramToInstagramOptions, string][] = [
  ["publishPost", "Publish as Instagram Post"], ["publishStory", "Publish as Instagram Story"], ["publishReel", "Publish Video as Reel"],
  ["copyCaption", "Copy Caption"], ["aiCaption", "Generate Instagram Caption with AI"], ["addHashtags", "Add Hashtags"], ["notifyAdmin", "Notify Admin"],
];

export function AutomationsPage() {
  const { data } = useAutomations();
  const router = useRouter();
  const t = useT();
  const { timeAgo, nf } = useFmt();
  const { simulate, busy } = useSimulation();
  const toggleOpt = useAction((patch: Partial<TelegramToInstagramOptions>) => apiFetch("/api/automations/options", { method: "PATCH", json: patch }));
  const toggleStatus = useAction((v: { id: string; status: "active" | "paused" }) => apiFetch(`/api/automations/${v.id}`, { method: "PATCH", json: { status: v.status } }));

  const main = data?.automations.find((a) => a.key === "tg-ig-post");
  const columns: Column<Automation>[] = [
    { key: "name", label: "Name", primary: true, cell: (a) => <span className="font-medium">{t(a.name)}</span> },
    { key: "trigger", label: "Trigger", cell: (a) => t(a.trigger) },
    { key: "action", label: "Action", cell: (a) => t(a.action) },
    { key: "status", label: "Status", cell: (a) => (
      <span onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
        <Switch checked={a.status === "active"} label={`${t("Toggle")} ${t(a.name)}`} onChange={(v) => toggleStatus.mutate({ id: a.id, status: v ? "active" : "paused" }, { onSuccess: () => toast.success(t(v ? "Automation enabled" : "Automation paused")) })} />
        <StatusBadge status={a.status} />
      </span>
    ) },
    { key: "last", label: "Last Run", cell: (a) => (a.lastRun ? timeAgo(a.lastRun) : "—") },
    { key: "rate", label: "Success", cell: (a) => <Badge tone={a.successRate >= 95 ? "success" : a.successRate >= 90 ? "warning" : "danger"}>{nf.format(a.successRate)}%</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Automations" description="Triggers and actions that run your social media on autopilot." />
      {!data || !main ? <Skeleton className="h-72" /> : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-4 border-b bg-gradient-to-r from-accent to-transparent p-5">
            <div className="flex items-center gap-2 text-primary"><span className="rounded-xl bg-card p-2.5 shadow-sm"><Send className="size-5" /></span><ArrowRight className="size-4 rtl:rotate-180" /><span className="rounded-xl bg-card p-2.5 shadow-sm"><Camera className="size-5" /></span></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{t("Telegram → Instagram")}</h2><StatusBadge status={main.status} /></div>
              <p dir="auto" className="mt-1 text-sm text-muted-foreground">{t(main.description)}</p>
            </div>
            <Button size="lg" onClick={() => simulate("telegram")} disabled={busy}><Send className="size-4" />{t("Simulate New Telegram Post")}</Button>
          </div>
          <div className="grid gap-x-8 gap-y-1 p-5 sm:grid-cols-2">
            {OPTION_LABELS.map(([k, label]) => (
              <label key={k} className="flex items-center justify-between gap-3 border-b py-3 text-sm last:border-0">
                {t(label)}
                <Switch checked={data.options[k]} label={t(label)} onChange={(v) => toggleOpt.mutate({ [k]: v })} />
              </label>
            ))}
          </div>
        </Card>
      )}
      <Card>
        <CardHeader title="All automations" description="Click a row to see its workflow." />
        {data ? <DataTable columns={columns} rows={data.automations} rowKey={(a) => a.id} onRowClick={(a) => router.push(`/automations/${a.id}`)} /> : <Skeleton className="m-5 h-48" />}
      </Card>
      <p className="text-xs text-muted-foreground"><Link href="/logs" className="text-primary hover:underline">{t("Activity Logs")}</Link> {t("record every execution.")}</p>
    </div>
  );
}
