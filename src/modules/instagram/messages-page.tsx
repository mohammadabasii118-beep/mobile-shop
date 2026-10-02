"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Bot, Search, Send, Star } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton } from "@/components/shared/query-state";
import { apiFetch, useAction, useConversations, type ConversationView } from "@/hooks/api";
import { cn } from "@/lib/cn";
import { useFmt } from "@/hooks/use-fmt";
import { useT } from "@/i18n/provider";
import { MessagesSquare } from "lucide-react";

type Filter = "all" | "unread" | "important" | "ai";

export function MessagesPage() {
  const { data, isLoading } = useConversations();
  const { timeAgo } = useFmt();
  const t = useT();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const convs = useMemo(() => data ?? [], [data]);

  const filtered = convs.filter((c) => {
    if (filter === "unread" && !c.unread) return false;
    if (filter === "important" && !c.important) return false;
    if (filter === "ai" && !c.aiHandled) return false;
    const s = q.trim().toLowerCase();
    return !s || c.customer.name.toLowerCase().includes(s) || c.customer.username.toLowerCase().includes(s);
  });
  const selected = convs.find((c) => c.id === selectedId) ?? null;
  // Desktop: auto-select first chat. Mobile keeps the list until the user taps one.
  const active = selected ?? (typeof window !== "undefined" && window.innerWidth >= 1024 ? filtered[0] ?? null : null);

  return (
    <div>
      <PageHeader title="Direct Messages" description="Instagram inbox with AI-assisted replies." />
      <Card className="flex h-[calc(100vh-14rem)] min-h-[520px] overflow-hidden">
        <div className={cn("flex w-full flex-col border-e lg:w-[22rem] lg:shrink-0", active && selectedId && "hidden lg:flex")}>
          <div className="space-y-3 border-b p-3">
            <div className="relative"><Search className="absolute top-2.5 start-3 size-4 text-muted-foreground" /><Input className="ps-9" placeholder={t("Search conversations")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("Search conversations")} /></div>
            <Tabs value={filter} onChange={setFilter} className="w-full" items={[{ value: "all", label: "All" }, { value: "unread", label: "Unread", count: convs.filter((c) => c.unread).length }, { value: "important", label: "Important" }, { value: "ai", label: "AI handled" }]} />
          </div>
          <ul className="flex-1 overflow-y-auto">
            {isLoading && <ListSkeleton />}
            {filtered.map((c) => (
              <li key={c.id}>
                <button onClick={() => { setSelectedId(c.id); if (c.unread) apiFetch(`/api/messages/${c.id}`, { method: "PATCH", json: { read: true } }); }} className={cn("flex w-full items-center gap-3 border-b px-4 py-3 text-start hover:bg-muted/60", active?.id === c.id && "bg-accent")}>
                  <Avatar name={c.customer.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{c.customer.name}</span><span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(c.lastAt)}</span></div>
                    <div className="flex items-center justify-between gap-2">
                      <span dir="auto" className="truncate text-xs text-muted-foreground">{c.messages.at(-1)?.text}</span>
                      {c.unread > 0 && <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">{c.unread}</span>}
                    </div>
                  </div>
                </button>
              </li>
            ))}
            {!isLoading && filtered.length === 0 && <EmptyState icon={MessagesSquare} title="No conversations" />}
          </ul>
        </div>

        {active ? <ChatPane key={active.id} conv={active} onBack={() => setSelectedId(null)} showBack={!!selectedId} /> : (
          <div className="hidden flex-1 lg:block"><EmptyState icon={MessagesSquare} title="Select a conversation" /></div>
        )}
      </Card>
    </div>
  );
}

function ChatPane({ conv, onBack, showBack }: { conv: ConversationView; onBack: () => void; showBack: boolean }) {
  const [text, setText] = useState("");
  const { time, toman, timeAgo } = useFmt();
  const t = useT();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [conv.messages.length]);
  const send = useAction((body: { mode: "manual" | "ai"; text?: string }) => apiFetch(`/api/messages/${conv.id}`, { method: "POST", json: body }));
  const star = useAction(() => apiFetch(`/api/messages/${conv.id}`, { method: "PATCH", json: { important: !conv.important } }));
  const c = conv.customer;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    send.mutate({ mode: "manual", text }, { onSuccess: () => setText(""), onError: (er) => toast.error(er.message) });
  }

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          {showBack && <Button variant="ghost" size="icon" className="lg:hidden" onClick={onBack} aria-label={t("Back")}><ArrowLeft className="size-4" /></Button>}
          <Avatar name={c.name} />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{c.name}</p><p className="text-xs text-muted-foreground"><bdi>@{c.username}</bdi></p></div>
          {conv.aiHandled && <Badge tone="primary"><Bot className="size-3" />{t("AI handled")}</Badge>}
          <Button variant="ghost" size="icon" onClick={() => star.mutate()} aria-label={t("Mark important")}><Star className={cn("size-4", conv.important && "fill-warning text-warning")} /></Button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
          {conv.messages.map((m) => (
            <div key={m.id} className={cn("flex", m.from === "customer" ? "justify-start" : "justify-end")}>
              <div className={cn("animate-step-in max-w-[80%] rounded-2xl px-4 py-2 text-sm", m.from === "customer" ? "rounded-es-sm border bg-card" : m.from === "bot" ? "rounded-ee-sm bg-primary text-primary-foreground" : "rounded-ee-sm bg-foreground text-background")}>
                {m.from !== "customer" && <p className="mb-0.5 text-[10px] font-medium uppercase opacity-70">{t(m.from === "bot" ? "AI Bot" : "You")}</p>}
                <p dir="auto" className="whitespace-pre-wrap">{m.text}</p>
                <p className="mt-1 text-end text-[10px] opacity-60">{time(m.at)}</p>
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>
        <form onSubmit={submit} className="flex items-center gap-2 border-t p-3">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("Type a message…")} aria-label={t("Message")} />
          <Button type="submit" loading={send.isPending && send.variables?.mode === "manual"} disabled={!text.trim()}><Send className="size-4" /><span className="hidden sm:inline">{t("Send")}</span></Button>
          <Button type="button" variant="secondary" loading={send.isPending && send.variables?.mode === "ai"} onClick={() => send.mutate({ mode: "ai" }, { onError: (er) => toast.error(er.message) })}><Bot className="size-4" /><span className="hidden sm:inline">{t("AI Reply")}</span></Button>
        </form>
      </div>
      <aside className="hidden w-72 shrink-0 space-y-4 overflow-y-auto border-s p-5 xl:block">
        <div className="text-center"><Avatar name={c.name} size={64} className="mx-auto" /><p className="mt-3 font-semibold">{c.name}</p><p className="text-xs text-muted-foreground"><bdi>@{c.username}</bdi></p></div>
        <dl className="space-y-3 text-sm">
          {[["Phone", c.phone], ["Orders", String(c.orders)], ["Total spent", toman(c.totalSpent)], ["Last contact", timeAgo(c.lastContact)]].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2"><dt className="text-muted-foreground">{t(k)}</dt><dd dir={k === "Phone" ? "ltr" : undefined} className="font-medium">{v}</dd></div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-1.5"><Badge tone={c.status === "VIP" ? "warning" : c.status === "New" ? "info" : "neutral"}>{t(c.status)}</Badge>{c.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>
      </aside>
    </>
  );
}
