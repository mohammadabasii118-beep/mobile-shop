"use client";
import Link from "next/link";
import { Eye, FileText, Radio, Send, Users, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { GridSkeleton } from "@/components/shared/query-state";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTelegram } from "@/hooks/api";
import { useSimulation } from "@/modules/simulation/simulation-provider";
import { formatDateTime, nf } from "@/utils/format";
import type { TelegramChannelInfo, TelegramPost } from "@/types";

function ChannelCard({ channel }: { channel: TelegramChannelInfo }) {
  return (
    <Card className="flex flex-wrap items-center gap-4 p-5">
      <div className="rounded-2xl bg-info/12 p-4 text-info"><Send className="size-7" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold">{channel.name}</p>
        <p className="text-sm text-muted-foreground">{channel.username}</p>
      </div>
      <StatusBadge status={channel.status} />
      <div className="text-right"><p className="text-2xl font-semibold tabular-nums">{nf.format(channel.members)}</p><p className="text-xs text-muted-foreground">Members</p></div>
    </Card>
  );
}

export function TelegramPostCard({ p }: { p: TelegramPost }) {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.imageUrl} alt="" className="size-full object-cover" />
        {p.mediaType === "video" && <Badge tone="primary" className="absolute top-3 right-3"><Video className="size-3" />Video</Badge>}
      </div>
      <div className="space-y-2.5 p-4">
        <p dir="auto" className="font-medium">{p.title}</p>
        <p dir="auto" className="line-clamp-2 text-sm text-muted-foreground">{p.caption}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatDateTime(p.date)}</span><span className="flex items-center gap-1"><Eye className="size-3.5" />{nf.format(p.views)}</span><StatusBadge status={p.status} />
        </div>
      </div>
    </Card>
  );
}

export function TelegramOverviewPage() {
  const { data } = useTelegram();
  const { simulate, busy } = useSimulation();
  return (
    <div>
      <PageHeader title="Telegram Overview" description="Channel status and latest content." actions={<Button onClick={() => simulate("telegram")} disabled={busy}><Send className="size-4" />Simulate New Telegram Post</Button>} />
      {!data ? <GridSkeleton count={3} className="h-40" /> : (
        <div className="space-y-6">
          <ChannelCard channel={data.channel} />
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Members" value={data.channel.members} icon={Users} tone="bg-info/12 text-info" />
            <StatCard label="Posts" value={data.posts.length} icon={FileText} />
            <StatCard label="Total views" value={data.posts.reduce((s, p) => s + p.views, 0)} icon={Eye} tone="bg-success/12 text-success" />
          </div>
          <Card>
            <CardHeader title="Latest posts" action={<Link className="text-xs text-primary hover:underline" href="/telegram/posts">View all</Link>} />
            <div className="grid gap-4 p-5 pt-2 sm:grid-cols-2 xl:grid-cols-3">{data.posts.slice(0, 3).map((p) => <TelegramPostCard key={p.id} p={p} />)}</div>
          </Card>
        </div>
      )}
    </div>
  );
}

export function TelegramChannelPage() {
  const { data } = useTelegram();
  return (
    <div>
      <PageHeader title="Telegram Channel" description="Connection details (demo values)." />
      {!data ? <GridSkeleton count={1} className="h-40" /> : (
        <div className="space-y-6">
          <ChannelCard channel={data.channel} />
          <Card>
            <CardHeader title="Channel details" />
            <dl className="grid gap-4 p-5 pt-2 sm:grid-cols-2">
              {[["Channel name", data.channel.name], ["Username", data.channel.username], ["Status", "Connected"], ["Bot permissions", "Read posts · Post as admin"], ["Webhook", "Verified (mock)"], ["Source", "Mock Telegram provider"]].map(([k, v]) => (
                <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-0.5 text-sm font-medium">{v}</dd></div>
              ))}
            </dl>
          </Card>
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Radio className="size-3.5" />Real channel linking arrives in the integration phase.</p>
        </div>
      )}
    </div>
  );
}

export function TelegramPostsPage() {
  const { data } = useTelegram();
  const { simulate, busy } = useSimulation();
  return (
    <div>
      <PageHeader title="Telegram Posts" description="Posts received from your channel." actions={<Button onClick={() => simulate("telegram")} disabled={busy}><Send className="size-4" />Simulate New Telegram Post</Button>} />
      {!data ? <GridSkeleton /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.posts.map((p) => <TelegramPostCard key={p.id} p={p} />)}</div>}
    </div>
  );
}
