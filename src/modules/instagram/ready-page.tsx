"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ClipboardCheck, Copy, Download, Info } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { GridSkeleton } from "@/components/shared/query-state";
import { apiFetch, useAction } from "@/hooks/api";
import { useFmt } from "@/hooks/use-fmt";
import { useT } from "@/i18n/provider";
import type { ReadyPost } from "@/types";

type Filter = "ready" | "posted";

/** navigator.clipboard only exists on https/localhost; fall back to a hidden textarea so it also works over plain http. */
async function copyText(text: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) return await navigator.clipboard.writeText(text);
  } catch { /* fall through */ }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("copy failed");
}

function ReadyCard({ item }: { item: ReadyPost }) {
  const t = useT();
  const { timeAgo } = useFmt();
  const setStatus = useAction((status: Filter) => apiFetch(`/api/instagram/ready/${item.id}`, { method: "PATCH", json: { status } }));
  const download = item.imageUrl.startsWith("/api/") ? `${item.imageUrl}&download=1` : item.imageUrl;
  return (
    <Card className="overflow-hidden">
      <div className="aspect-square">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageUrl} alt="" className="size-full object-cover" />
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p dir="auto" className="truncate text-sm font-medium">{item.title}</p>
          <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
        </div>
        <textarea readOnly dir="auto" value={item.caption} rows={5} className="w-full resize-none rounded-lg border bg-muted/40 p-3 text-sm" aria-label={t("Instagram caption")} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => copyText(item.caption).then(() => toast.success(t("Caption copied")), () => toast.error(t("Could not copy — select the text manually")))}><Copy className="size-3.5" />{t("Copy caption")}</Button>
          <a href={download} download={`post-${item.id}.jpg`}><Button size="sm" variant="outline" type="button"><Download className="size-3.5" />{t("Download image")}</Button></a>
          {item.status === "ready"
            ? <Button size="sm" variant="success" loading={setStatus.isPending} onClick={() => setStatus.mutate("posted", { onSuccess: () => toast.success(t("Marked as posted")) })}><Check className="size-3.5" />{t("Mark as posted")}</Button>
            : <Badge tone="success" dot>{t("Posted")}</Badge>}
        </div>
      </div>
    </Card>
  );
}

export function ReadyPage() {
  const t = useT();
  const { data, isLoading } = useQuery({ queryKey: ["ready"], queryFn: () => apiFetch<{ mode: string; items: ReadyPost[] }>("/api/instagram/ready"), refetchInterval: 10000 });
  const [filter, setFilter] = useState<Filter>("ready");
  const items = data?.items ?? [];
  const shown = items.filter((i) => i.status === filter);
  return (
    <div>
      <PageHeader title="Ready to Post" description="Posts prepared from Telegram. Copy the caption, save the image, then post it in the Instagram app." />
      {data && data.mode !== "manual" && (
        <Card className="mb-5 flex items-start gap-3 p-4 text-sm"><Info className="mt-0.5 size-4 shrink-0 text-info" /><span>{t("Semi-automatic mode is off. Add INSTAGRAM_MODE=manual to the server .env and restart to fill this list from new Telegram posts.")}</span></Card>
      )}
      <Tabs className="mb-5" value={filter} onChange={setFilter} items={[{ value: "ready", label: "Ready", count: items.filter((i) => i.status === "ready").length }, { value: "posted", label: "Posted", count: items.filter((i) => i.status === "posted").length }]} />
      {isLoading ? <GridSkeleton /> : shown.length === 0 ? (
        <Card><EmptyState icon={ClipboardCheck} title="Nothing here yet" description="New Telegram channel posts will appear here automatically." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{shown.map((i) => <ReadyCard key={i.id} item={i} />)}</div>
      )}
    </div>
  );
}
