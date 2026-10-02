"use client";
import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton } from "@/components/shared/query-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { useLogs } from "@/hooks/api";
import { useFmt } from "@/hooks/use-fmt";
import { useT } from "@/i18n/provider";
import type { ActivityLog } from "@/types";

type Filter = "all" | ActivityLog["status"];

function useColumns(): Column<ActivityLog>[] {
  const { dateTime } = useFmt();
  const t = useT();
  return [
  { key: "title", label: "Event", primary: true, cell: (l) => t(l.title) },
  { key: "time", label: "Timestamp", cell: (l) => <span className="whitespace-nowrap">{dateTime(l.at)}</span> },
  { key: "type", label: "Type", cell: (l) => <code className="text-xs">{l.type}</code> },
  { key: "status", label: "Status", cell: (l) => <StatusBadge status={l.status} /> },
  { key: "details", label: "Details", cell: (l) => <span dir="auto" className="text-muted-foreground">{l.details}</span> },
  ];
}

export function LogsPage() {
  const { data, isLoading } = useLogs();
  const columns = useColumns();
  const [filter, setFilter] = useState<Filter>("all");
  const all = data ?? [];
  const rows = filter === "all" ? all : all.filter((l) => l.status === filter);
  return (
    <div>
      <PageHeader title="Activity Logs" description="Every event handled by the system." />
      <Card>
        <div className="border-b p-4"><Tabs value={filter} onChange={setFilter} items={(["all", "success", "info", "warning", "error"] as Filter[]).map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1), count: v === "all" ? all.length : all.filter((l) => l.status === v).length }))} /></div>
        {isLoading ? <ListSkeleton /> : rows.length === 0 ? <EmptyState icon={ClipboardList} title="No events" /> : <DataTable columns={columns} rows={rows} rowKey={(l) => l.id} />}
      </Card>
    </div>
  );
}
