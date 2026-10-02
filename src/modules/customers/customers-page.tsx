"use client";
import { useState } from "react";
import { Search, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton } from "@/components/shared/query-state";
import { useCustomers } from "@/hooks/api";
import { useFmt } from "@/hooks/use-fmt";
import { useT } from "@/i18n/provider";
import type { Customer } from "@/types";

type Filter = "all" | Customer["status"];
const TONE = { VIP: "warning", New: "info", Returning: "success" } as const;

function useColumns(): Column<Customer>[] {
  const { toman, timeAgo, nf } = useFmt();
  const t = useT();
  return [
  { key: "name", label: "Name", primary: true, cell: (c) => <span className="flex items-center gap-3"><Avatar name={c.name} size={32} /><span dir="auto" className="font-medium">{c.name}</span></span> },
  { key: "user", label: "Username", cell: (c) => <span className="text-muted-foreground"><bdi>@{c.username}</bdi></span> },
  { key: "phone", label: "Phone", cell: (c) => <span dir="ltr">{c.phone}</span> },
  { key: "last", label: "Last Contact", cell: (c) => timeAgo(c.lastContact) },
  { key: "orders", label: "Orders", cell: (c) => nf.format(c.orders) },
  { key: "spent", label: "Total Spent", cell: (c) => <span dir="auto">{toman(c.totalSpent)}</span> },
  { key: "tags", label: "Tags", cell: (c) => <span className="flex flex-wrap gap-1">{c.tags.map((t) => <Badge key={t}>{t}</Badge>)}</span> },
  { key: "status", label: "Status", cell: (c) => <Badge tone={TONE[c.status]}>{t(c.status)}</Badge> },
  ];
}

export function CustomersPage() {
  const { data, isLoading } = useCustomers();
  const t = useT();
  const columns = useColumns();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const all = data ?? [];
  const rows = all.filter((c) => (filter === "all" || c.status === filter) && `${c.name} ${c.username} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader title="Customers" description="Everyone who has contacted your store." />
      <Card>
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xs"><Search className="absolute top-2.5 start-3 size-4 text-muted-foreground" /><Input className="ps-9" placeholder={t("Search customers")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("Search customers")} /></div>
          <Tabs value={filter} onChange={setFilter} items={(["all", "VIP", "New", "Returning"] as Filter[]).map((v) => ({ value: v, label: v === "all" ? "All" : v, count: v === "all" ? all.length : all.filter((c) => c.status === v).length }))} />
        </div>
        {isLoading ? <ListSkeleton /> : rows.length === 0 ? <EmptyState icon={Users} title="No customers match" /> : <DataTable columns={columns} rows={rows} rowKey={(c) => c.id} />}
      </Card>
    </div>
  );
}
