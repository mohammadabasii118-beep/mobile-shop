"use client";
import { useState } from "react";
import { Bot, Check, MessageCircleOff, Reply, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton } from "@/components/shared/query-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { apiFetch, useAction, useComments, usePosts } from "@/hooks/api";
import { timeAgo } from "@/utils/format";
import type { Comment } from "@/types";

type Filter = "all" | Comment["status"];

function CommentCard({ c, postImage }: { c: Comment; postImage?: string }) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState(c.aiSuggestion);
  const act = useAction((body: object) => apiFetch(`/api/comments/${c.id}`, { method: "PATCH", json: body }));
  const run = (body: object, msg: string) => act.mutate(body, { onSuccess: () => { toast.success(msg); setReplying(false); }, onError: (e) => toast.error(e.message) });
  const open = c.status === "new";
  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <Avatar name={c.username} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">@{c.username}</span><StatusBadge status={c.status} /><span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
          </div>
          <p dir="auto" className="text-sm">{c.text}</p>
          {postImage && <div className="flex items-center gap-2 text-xs text-muted-foreground">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={postImage} alt="" className="size-6 rounded object-cover" />on post {c.postId}</div>}
          {c.reply && <div dir="auto" className="rounded-lg bg-success/10 p-3 text-sm"><span className="mb-1 block text-xs font-medium text-success">Replied</span>{c.reply}</div>}
          {open && !replying && (
            <div dir="auto" className="rounded-lg border border-dashed border-primary/40 bg-accent p-3 text-sm">
              <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary"><Sparkles className="size-3.5" />AI Suggestion</span>{c.aiSuggestion}
            </div>
          )}
          {replying && (
            <div className="space-y-2"><Textarea value={text} onChange={(e) => setText(e.target.value)} />
              <div className="flex gap-2"><Button size="sm" loading={act.isPending} disabled={!text.trim()} onClick={() => run({ action: "reply", text }, "Reply sent")}>Send reply</Button><Button size="sm" variant="ghost" onClick={() => setReplying(false)}>Cancel</Button></div></div>
          )}
          {open && !replying && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => { setText(""); setReplying(true); }}><Reply className="size-3.5" />Reply</Button>
              <Button size="sm" loading={act.isPending} onClick={() => run({ action: "reply", text: c.aiSuggestion }, "AI reply sent")}><Bot className="size-3.5" />AI Reply</Button>
              <Button size="sm" variant="ghost" onClick={() => run({ action: "ignore" }, "Comment ignored")}><X className="size-3.5" />Ignore</Button>
              <Button size="sm" variant="success" onClick={() => run({ action: "resolve" }, "Marked as resolved")}><Check className="size-3.5" />Mark as Resolved</Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function CommentsPage() {
  const { data, isLoading } = useComments();
  const { data: posts } = usePosts();
  const [filter, setFilter] = useState<Filter>("all");
  const all = data ?? [];
  const shown = filter === "all" ? all : all.filter((c) => c.status === filter);
  const items: Filter[] = ["all", "new", "replied", "resolved", "ignored"];
  return (
    <div>
      <PageHeader title="Instagram Comments" description="Reply manually, let AI answer, or triage." />
      <Tabs className="mb-5" value={filter} onChange={setFilter} items={items.map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1), count: v === "all" ? all.length : all.filter((c) => c.status === v).length }))} />
      {isLoading ? <Card><ListSkeleton /></Card> : shown.length === 0 ? (
        <Card><EmptyState icon={MessageCircleOff} title="No comments" description="Use Simulate → Instagram Comment to create one." /></Card>
      ) : (
        <div className="grid gap-3">{shown.map((c) => <CommentCard key={c.id} c={c} postImage={posts?.find((p) => p.id === c.postId)?.imageUrl} />)}</div>
      )}
    </div>
  );
}
