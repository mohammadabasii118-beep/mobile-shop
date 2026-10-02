"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bot, Camera, FileText, MessageCircle, MessagesSquare, Rocket, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { StatCard } from "@/components/shared/stat-card";
import { useDashboard } from "@/hooks/api";
import { useSimulation } from "@/modules/simulation/simulation-provider";

const axis = { stroke: "var(--muted-foreground)", fontSize: 12, tickLine: false, axisLine: false } as const;
const tip = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 } };

export function DashboardPage() {
  const { data, isLoading } = useDashboard();
  const { simulate, busy } = useSimulation();
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []); // client-only: avoids SSR/locale hydration mismatch
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">سلام 👋 خوش آمدید</h1>
          <p className="mt-1 h-5 text-sm text-muted-foreground">
            {today && `${today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${today.toLocaleDateString("fa-IR", { day: "numeric", month: "long", year: "numeric" })}`}
          </p>
        </div>
        <Button size="lg" onClick={() => simulate("full")} disabled={busy} className="bg-gradient-to-r from-primary to-fuchsia-500 shadow-lg shadow-primary/25">
          <Rocket className="size-4" /> 🚀 Run Full Demo
        </Button>
      </div>

      {isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Instagram Followers" value={data.stats.followers} icon={Camera} tone="bg-fuchsia-500/12 text-fuchsia-500" />
            <StatCard label="Telegram Members" value={data.stats.members} icon={Send} tone="bg-info/12 text-info" />
            <StatCard label="Posts Published" value={data.stats.published} icon={FileText} tone="bg-success/12 text-success" />
            <StatCard label="Messages Today" value={data.stats.messagesToday} icon={MessagesSquare} tone="bg-warning/15 text-warning" />
            <StatCard label="Comments Today" value={data.stats.commentsToday} icon={MessageCircle} tone="bg-danger/12 text-danger" />
            <StatCard label="AI Replies" value={data.stats.aiReplies} icon={Bot} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Messages / Comments" description="Last 7 days" />
              <div className="h-64 px-2 pb-4">
                <ResponsiveContainer>
                  <LineChart data={data.engagement}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" {...axis} /><YAxis {...axis} width={32} />
                    <Tooltip {...tip} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="messages" stroke="var(--primary)" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="comments" stroke="var(--info)" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardHeader title="Content Published" description="Posts and stories, last 7 days" />
              <div className="h-64 px-2 pb-4">
                <ResponsiveContainer>
                  <BarChart data={data.content}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" {...axis} /><YAxis {...axis} width={32} />
                    <Tooltip {...tip} cursor={{ fill: "var(--muted)" }} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="posts" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="stories" fill="var(--info)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Activity" action={<Link href="/logs" className="text-xs text-primary hover:underline">View all</Link>} />
              <ActivityFeed items={data.activity} />
            </Card>
            <Card>
              <CardHeader title="Needs attention" />
              <div className="space-y-3 p-5 pt-1">
                <Link href="/instagram/comments" className="flex items-center justify-between rounded-lg bg-muted p-3 hover:bg-border">
                  <span className="flex items-center gap-2 text-sm"><MessageCircle className="size-4" />Unanswered comments</span><b>{data.pendingComments}</b>
                </Link>
                <Link href="/instagram/messages" className="flex items-center justify-between rounded-lg bg-muted p-3 hover:bg-border">
                  <span className="flex items-center gap-2 text-sm"><MessagesSquare className="size-4" />Unread chats</span><b>{data.unreadChats}</b>
                </Link>
                <Link href="/automations" className="flex items-center justify-between rounded-lg bg-muted p-3 hover:bg-border">
                  <span className="flex items-center gap-2 text-sm"><Users className="size-4" />Automations</span><span className="text-xs text-muted-foreground">Manage →</span>
                </Link>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
