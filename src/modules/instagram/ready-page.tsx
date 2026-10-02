"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ClipboardCheck, Copy, Download, Info, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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

interface IgStatus {
  mode: string; dailyLimit: number; autoPublish: boolean;
  sidecar: { reachable: boolean; dryRun?: boolean; loggedIn?: boolean; username?: string; error?: string | null } | null;
}

function ReadyCard({ item, canPublish }: { item: ReadyPost; canPublish: boolean }) {
  const t = useT();
  const [confirm, setConfirm] = useState<("photo" | "story")[] | null>(null);
  const publish = useAction((kinds: ("photo" | "story")[]) => apiFetch(`/api/instagram/ready/${item.id}/publish`, { method: "POST", json: { kinds } }));
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
          {canPublish && item.status === "ready" && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setConfirm(["photo"])}><Send className="size-3.5" />{t("Publish to Instagram")}</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(["story"])}>{t("As story")}</Button>
            </>
          )}
          {item.status === "ready"
            ? <Button size="sm" variant="success" loading={setStatus.isPending} onClick={() => setStatus.mutate("posted", { onSuccess: () => toast.success(t("Marked as posted")) })}><Check className="size-3.5" />{t("Mark as posted")}</Button>
            : <Badge tone="success" dot>{t("Posted")}</Badge>}
        </div>
      </div>
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title="Publish to Instagram?" description="This posts to your real Instagram account now.">
        <p dir="auto" className="mb-4 line-clamp-4 rounded-lg bg-muted p-3 text-sm">{item.caption}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirm(null)}>{t("Cancel")}</Button>
          <Button loading={publish.isPending} onClick={() => confirm && publish.mutate(confirm, { onSuccess: () => { toast.success(t("Published to Instagram")); setConfirm(null); }, onError: (e) => toast.error(t(e.message)) })}><Send className="size-4" />{t("Publish")}</Button>
        </div>
      </Dialog>
    </Card>
  );
}

function ConnectCard({ status }: { status: IgStatus }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const connect = useAction(() => apiFetch("/api/instagram/connect", { method: "POST", json: { code } }));
  const s = status.sidecar;
  const ok = s?.reachable && s.loggedIn;
  return (
    <Card className="mb-5 flex flex-wrap items-center gap-3 p-4">
      <span className={`size-2.5 rounded-full ${ok ? "bg-success" : "bg-warning"}`} />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">{!s?.reachable ? t("Instagram service is not running on the server") : ok ? `${t("Instagram connected")}${s.username ? ` · @${s.username}` : ""}${s.dryRun ? ` · ${t("test mode")}` : ""}` : t("Instagram not connected yet")}</p>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><TriangleAlert className="mt-0.5 size-3 shrink-0 text-warning" />{t("Unofficial method: it violates Instagram's terms and the account can be limited. Posts are sent only when you confirm.")} ({status.dailyLimit}/24h)</p>
      </div>
      {s?.reachable && <Button size="sm" variant={ok ? "outline" : "primary"} onClick={() => setOpen(true)}>{t(ok ? "Reconnect" : "Connect")}</Button>}
      <Dialog open={open} onClose={() => setOpen(false)} title="Connect Instagram" description="Uses the username and password saved in the server .env. If Instagram asks for a code, enter it below.">
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); connect.mutate(undefined, { onSuccess: () => { toast.success(t("Instagram connected")); setOpen(false); setCode(""); }, onError: (er) => toast.error(t(er.message)) }); }}>
          <label className="grid gap-1.5 text-sm"><span className="font-medium">{t("Two-factor code (optional)")}</span><Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={8} dir="ltr" /></label>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("Cancel")}</Button><Button type="submit" loading={connect.isPending}>{t("Connect")}</Button></div>
        </form>
      </Dialog>
    </Card>
  );
}

export function ReadyPage() {
  const t = useT();
  const { data, isLoading } = useQuery({ queryKey: ["ready"], queryFn: () => apiFetch<{ mode: string; items: ReadyPost[] }>("/api/instagram/ready"), refetchInterval: 10000 });
  const { data: ig } = useQuery({ queryKey: ["ig-status"], queryFn: () => apiFetch<IgStatus>("/api/instagram/status"), refetchInterval: 15000 });
  const [filter, setFilter] = useState<Filter>("ready");
  const items = data?.items ?? [];
  const shown = items.filter((i) => i.status === filter);
  return (
    <div>
      <PageHeader title="Ready to Post" description="Posts prepared from Telegram. Copy the caption, save the image, then post it in the Instagram app." />
      {ig?.mode === "unofficial" && <ConnectCard status={ig} />}
      {data && data.mode === "mock" && (
        <Card className="mb-5 flex items-start gap-3 p-4 text-sm"><Info className="mt-0.5 size-4 shrink-0 text-info" /><span>{t("Semi-automatic mode is off. Add INSTAGRAM_MODE=manual to the server .env and restart to fill this list from new Telegram posts.")}</span></Card>
      )}
      <Tabs className="mb-5" value={filter} onChange={setFilter} items={[{ value: "ready", label: "Ready", count: items.filter((i) => i.status === "ready").length }, { value: "posted", label: "Posted", count: items.filter((i) => i.status === "posted").length }]} />
      {isLoading ? <GridSkeleton /> : shown.length === 0 ? (
        <Card><EmptyState icon={ClipboardCheck} title="Nothing here yet" description="New Telegram channel posts will appear here automatically." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{shown.map((i) => <ReadyCard key={i.id} item={i} canPublish={ig?.mode === "unofficial" && !!ig.sidecar?.loggedIn} />)}</div>
      )}
    </div>
  );
}
