"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Lock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { apiFetch, useAction, useSettings } from "@/hooks/api";
import type { AppSettings } from "@/types";
import { useT } from "@/i18n/provider";

type Tab = "general" | "instagram" | "telegram" | "ai" | "notifications" | "security" | "automation";
const TABS: Tab[] = ["general", "instagram", "telegram", "ai", "notifications", "security", "automation"];

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-4 border-b py-4 last:border-0">
      <div><p className="text-sm font-medium">{t(title)}</p>{hint && <p className="text-xs text-muted-foreground">{t(hint)}</p>}</div>{children}
    </div>
  );
}
const Readonly = ({ label, value }: { label: string; value: string }) => (
  <Field label={label}><Input value={value} readOnly className="bg-muted/50 font-mono text-xs" dir="ltr" /></Field>
);
function DemoNote() {
  const t = useT();
  return <Badge tone="primary">{t("DEMO MODE · fake values")}</Badge>;
}

export function SettingsPage() {
  const { data } = useSettings();
  const t = useT();
  const [tab, setTab] = useState<Tab>("general");
  const patch = useAction((body: Partial<AppSettings>) => apiFetch("/api/settings", { method: "PATCH", json: body }));
  const reset = useAction(() => apiFetch("/api/settings/reset", { method: "POST" }));
  const [name, setName] = useState<string | null>(null);
  const update = (b: Partial<AppSettings>, msg = "Settings saved") => patch.mutate(b, { onSuccess: () => toast.success(t(msg)), onError: (e) => toast.error(e.message) });

  return (
    <div>
      <PageHeader title="Settings" description="Workspace configuration." />
      <Tabs className="mb-5" value={tab} onChange={setTab} items={TABS.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))} />
      {!data ? <Skeleton className="h-80" /> : (
        <Card className="max-w-3xl">
          {tab === "general" && (
            <div className="p-5">
              <div className="grid gap-4 pb-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="Application name" hint="Shown in the sidebar and browser title."><Input value={name ?? data.appName} onChange={(e) => setName(e.target.value)} /></Field>
                <Button loading={patch.isPending} disabled={!name || name === data.appName} onClick={() => update({ appName: name! }, "Name updated")}>{t("Save")}</Button>
              </div>
              <Row title="Demo Mode" hint="When ON, only mock providers are used and no external API is called."><Switch checked={data.demoMode} onChange={(v) => update({ demoMode: v })} label={t("Demo mode")} /></Row>
              <Row title="Language" hint="Content language for AI replies"><Badge>{t("Persian (fa)")}</Badge></Row>
              <Row title="Timezone"><Badge>{data.timezone}</Badge></Row>
              <Row title="Reset demo data" hint="Restore the original seed data."><Button variant="outline" loading={reset.isPending} onClick={() => reset.mutate(undefined, { onSuccess: () => toast.success(t("Demo data reset")) })}><RotateCcw className="size-4" />{t("Reset")}</Button></Row>
            </div>
          )}
          {tab === "instagram" && (
            <>
              <CardHeader title="Instagram connection" action={<DemoNote />} />
              <div className="grid gap-4 p-5 pt-2 sm:grid-cols-2">
                <Field label="Connection status"><div><StatusBadge status="connected" /></div></Field>
                <Readonly label="Connected account" value={data.instagram.account} />
                <Readonly label="Business Account ID" value={data.instagram.businessAccountId} />
                <Readonly label="Access token (masked)" value={data.instagram.accessToken} />
                <Field label="Webhook status"><div><StatusBadge status={data.instagram.webhook} /></div></Field>
              </div>
              <p className="flex items-center gap-2 px-5 pb-5 text-xs text-muted-foreground"><Lock className="size-3.5" />{t("Tokens are masked by the server and will live in encrypted storage / env vars in production.")}</p>
            </>
          )}
          {tab === "telegram" && (
            <>
              <CardHeader title="Telegram connection" action={data.telegram.live ? <Badge tone="success">LIVE</Badge> : <DemoNote />} />
              <div className="grid gap-4 p-5 pt-2 sm:grid-cols-2">
                <Readonly label="Channel" value={data.telegram.channel} />
                <Readonly label="Bot token (masked)" value={data.telegram.botToken} />
                <Field label="Webhook status"><div><StatusBadge status={data.telegram.webhook} /></div></Field>
              </div>
            </>
          )}
          {tab === "ai" && (
            <div className="p-5"><Row title="AI provider" hint="Mock provider. OpenAI plugs in through the AIProvider interface."><Badge tone="primary">{t("Mock")}</Badge></Row>
              <Row title="Assistant behavior" hint="Tone, business knowledge and rules"><Link href="/ai"><Button variant="outline">{t("Open AI Assistant")}</Button></Link></Row></div>
          )}
          {tab === "notifications" && (
            <div className="p-5">
              <Row title="Email notifications" hint="Post published, AI escalations"><Switch checked={data.notifyEmail} onChange={(v) => update({ notifyEmail: v })} label={t("Email notifications")} /></Row>
              <Row title="Push notifications" hint="Browser / mobile push (future)"><Switch checked={data.notifyPush} onChange={(v) => update({ notifyPush: v })} label={t("Push notifications")} /></Row>
            </div>
          )}
          {tab === "security" && (
            <div className="p-5">
              <Row title="Two-factor authentication" hint="Structure in place; enforced in production"><Switch checked={data.twoFactor} onChange={(v) => update({ twoFactor: v })} label={t("Two-factor")} /></Row>
              <Row title="Session" hint="HttpOnly signed cookie · 7 days"><Badge tone="success">{t("Secure")}</Badge></Row>
              <Row title="Rate limiting" hint="Per-user, per-endpoint (in-memory in demo)"><Badge tone="success">{t("Enabled")}</Badge></Row>
              <Row title="Webhook verification" hint="HMAC / secret-token checks ready; disabled in demo"><Badge>{t("Ready")}</Badge></Row>
            </div>
          )}
          {tab === "automation" && (
            <div className="p-5"><Row title="Automation rules" hint="Enable, disable and inspect workflows"><Link href="/automations"><Button variant="outline">{t("Manage automations")}</Button></Link></Row></div>
          )}
        </Card>
      )}
    </div>
  );
}
