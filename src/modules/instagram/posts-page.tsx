"use client";
import { useState } from "react";
import { Heart, ImageOff, MessageCircle, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { GridSkeleton } from "@/components/shared/query-state";
import { SourceBadge, StatusBadge } from "@/components/shared/status-badge";
import { usePosts } from "@/hooks/api";
import { formatDateTime, nf } from "@/utils/format";

type Filter = "all" | "published" | "scheduled" | "failed";

export function PostsPage() {
  const { data, isLoading } = usePosts();
  const [filter, setFilter] = useState<Filter>("all");
  const posts = data ?? [];
  const count = (s: Filter) => (s === "all" ? posts.length : posts.filter((p) => p.status === s).length);
  const shown = filter === "all" ? posts : posts.filter((p) => p.status === filter);
  return (
    <div>
      <PageHeader title="Instagram Posts" description="Everything published to your Instagram account." />
      <Tabs className="mb-5" value={filter} onChange={setFilter} items={(["all", "published", "scheduled", "failed"] as Filter[]).map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1), count: count(v) }))} />
      {isLoading ? <GridSkeleton /> : shown.length === 0 ? (
        <Card><EmptyState icon={ImageOff} title="No posts here yet" description="Try another filter or simulate a Telegram post." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt="" className="size-full object-cover" />
                <div className="absolute top-3 left-3 flex gap-1.5"><StatusBadge status={p.status} />{p.kind === "reel" && <Badge tone="primary"><Play className="size-3" />Reel</Badge>}</div>
              </div>
              <div className="space-y-3 p-4">
                <p dir="auto" className="line-clamp-2 min-h-10 text-sm">{p.caption}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-3"><span className="flex items-center gap-1"><Heart className="size-3.5" />{nf.format(p.likes)}</span><span className="flex items-center gap-1"><MessageCircle className="size-3.5" />{p.comments}</span></span>
                  <span>{formatDateTime(p.date)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">Source <SourceBadge source={p.source} /></div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
