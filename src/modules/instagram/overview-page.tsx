"use client";
import Link from "next/link";
import { Camera, CircleDot, Heart, ImageIcon, MessageCircle, MessagesSquare } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useComments, useConversations, usePosts, useStories } from "@/hooks/api";
import { useFmt } from "@/hooks/use-fmt";
import { useT } from "@/i18n/provider";

export function InstagramOverviewPage() {
  const { data: posts = [] } = usePosts();
  const { data: stories = [] } = useStories();
  const { data: comments = [] } = useComments();
  const { data: convs = [] } = useConversations();
  const { nf } = useFmt();
  const t = useT();
  const likes = posts.reduce((s, p) => s + p.likes, 0);
  return (
    <div>
      <PageHeader title="Instagram Overview" description="@caseline.official · Business account (demo)" actions={<StatusBadge status="connected" />} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Posts" value={posts.length} icon={ImageIcon} />
        <StatCard label="Stories" value={stories.length} icon={CircleDot} tone="bg-info/12 text-info" />
        <StatCard label="Total likes" value={likes} icon={Heart} tone="bg-danger/12 text-danger" />
        <StatCard label="Open comments" value={comments.filter((c) => c.status === "new").length} icon={MessageCircle} tone="bg-warning/15 text-warning" />
        <StatCard label="Conversations" value={convs.length} icon={MessagesSquare} tone="bg-success/12 text-success" />
        <StatCard label="Followers" value={12842} icon={Camera} tone="bg-fuchsia-500/12 text-fuchsia-500" />
      </div>
      <Card>
        <CardHeader title="Latest posts" action={<Link className="text-xs text-primary hover:underline" href="/instagram/posts">{t("View all")}</Link>} />
        <div className="grid grid-cols-3 gap-2 p-5 pt-2 sm:grid-cols-6">
          {posts.slice(0, 6).map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.imageUrl} alt="" className="aspect-square rounded-lg object-cover" />
          ))}
        </div>
        <p className="px-5 pb-5 text-xs text-muted-foreground">{nf.format(posts.length)} {t("posts")} · {nf.format(likes)} {t("likes total")}</p>
      </Card>
    </div>
  );
}
