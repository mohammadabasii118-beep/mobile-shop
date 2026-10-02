"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, Plus, Save, Send, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { apiFetch, useAction, useAiSettings } from "@/hooks/api";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/provider";
import type { AISettings, AiTone } from "@/types";

const TONES: { value: AiTone; label: string }[] = [
  { value: "friendly", label: "Friendly" }, { value: "professional", label: "Professional" }, { value: "short", label: "Short" },
  { value: "sales", label: "Sales" }, { value: "persian", label: "Persian" },
];

function SettingsForm({ initial }: { initial: AISettings }) {
  const [s, setS] = useState(initial);
  const t = useT();
  const save = useAction(() => apiFetch("/api/ai/settings", { method: "PUT", json: s }));
  const set = <K extends keyof AISettings>(k: K, v: AISettings[K]) => setS((p) => ({ ...p, [k]: v }));
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="AI Customer Assistant" description="Replies to comments and direct messages on your behalf." action={<StatusBadge status={s.enabled ? "active" : "paused"} />} />
        <div className="space-y-5 p-5 pt-2">
          <div className="flex items-center justify-between"><span className="text-sm font-medium">{t("Assistant enabled")}</span><Switch checked={s.enabled} onChange={(v) => set("enabled", v)} label="Assistant enabled" /></div>
          <div className="flex items-center justify-between"><span className="text-sm font-medium">{t("Send replies automatically")}</span><Switch checked={s.autoReply} onChange={(v) => set("autoReply", v)} label="Auto reply" /></div>
          <div>
            <p className="mb-2 text-sm font-medium">{t("AI Tone")}</p>
            <div className="flex flex-wrap gap-2">
              {TONES.map((tn) => {
                const on = s.tones.includes(tn.value);
                return <button key={tn.value} aria-pressed={on} onClick={() => set("tones", on ? s.tones.filter((x) => x !== tn.value) : [...s.tones, tn.value])} className={cn("rounded-full border px-3.5 py-1.5 text-sm transition", on ? "border-primary bg-accent font-medium text-primary" : "text-muted-foreground hover:bg-muted")}>{t(tn.label)}</button>;
              })}
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Business Knowledge" description="The assistant uses this to answer customers." />
        <div className="grid gap-4 p-5 pt-2 sm:grid-cols-2">
          <Field label="Store name"><Input value={s.businessName} onChange={(e) => set("businessName", e.target.value)} /></Field>
          <Field label="Business type"><Input value={s.businessType} onChange={(e) => set("businessType", e.target.value)} /></Field>
          <Field label="Working hours"><Input value={s.workingHours} onChange={(e) => set("workingHours", e.target.value)} /></Field>
        </div>
        <div className="space-y-2 p-5 pt-0">
          <p className="text-sm font-medium">{t("Response rules")}</p>
          {s.rules.map((r, i) => (
            <div key={i} className="flex gap-2">
              <Input value={r} onChange={(e) => set("rules", s.rules.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`${t("Rule")} ${i + 1}`} />
              <Button variant="ghost" size="icon" aria-label={t("Remove rule")} onClick={() => set("rules", s.rules.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set("rules", [...s.rules, ""])}><Plus className="size-4" />{t("Add rule")}</Button>
        </div>
      </Card>
      <Button size="lg" loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: () => toast.success(t("AI settings saved")), onError: (e) => toast.error(e.message) })}><Save className="size-4" />{t("Save AI Settings")}</Button>
    </div>
  );
}

interface Turn { role: "user" | "ai"; text: string; confident?: boolean }

function TestChat() {
  const t = useT();
  const [turns, setTurns] = useState<Turn[]>([{ role: "ai", text: "سلام 🌹 من دستیار هوشمند فروشگاه هستم. هر سوالی دارید بپرسید." }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [turns, busy]);

  async function send(e: FormEvent, preset?: string) {
    e.preventDefault();
    const msg = (preset ?? text).trim();
    if (!msg || busy) return;
    setText(""); setBusy(true);
    setTurns((t) => [...t, { role: "user", text: msg }]);
    try {
      const r = await apiFetch<{ text: string; confident: boolean }>("/api/ai/chat", { method: "POST", json: { text: msg } });
      setTurns((t) => [...t, { role: "ai", text: r.text, confident: r.confident }]);
    } catch (er) { toast.error((er as Error).message); }
    setBusy(false);
  }

  return (
    <Card className="flex h-[640px] flex-col lg:sticky lg:top-24">
      <CardHeader title="Test Chat" description="Mock AI provider — swap for OpenAI later." action={<Badge tone="primary">{t("Mock")}</Badge>} />
      <div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
        {turns.map((turn, i) => (
          <div key={i} className={cn("flex gap-2", turn.role === "user" ? "justify-end" : "justify-start")}>
            {turn.role === "ai" && <span className="mt-1 rounded-full bg-primary p-1.5 text-primary-foreground"><Bot className="size-3.5" /></span>}
            <div className={cn("animate-step-in max-w-[80%] rounded-2xl px-4 py-2 text-sm", turn.role === "user" ? "bg-foreground text-background" : "border bg-card")}>
              <p dir="auto">{turn.text}</p>
              {turn.confident === false && <p className="mt-1 flex items-center gap-1 text-[11px] text-warning"><TriangleAlert className="size-3" />{t("Low confidence — would escalate to admin")}</p>}
            </div>
            {turn.role === "user" && <Avatar name="You" size={28} className="mt-1" />}
          </div>
        ))}
        {busy && <p className="text-xs text-muted-foreground">{t("AI is typing…")}</p>}
        <div ref={end} />
      </div>
      <div className="flex flex-wrap gap-1.5 border-t px-4 pt-3">
        {["سلام قاب آیفون 17 پرو دارید؟", "قیمت شارژر چنده؟", "کابل تایپ‌سی موجوده؟", "گارانتی دارید؟"].map((q) => (
          <button key={q} dir="auto" onClick={(e) => send(e, q)} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted">{q}</button>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2 p-4 pt-3">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("Message the AI…")} aria-label={t("Test message")} />
        <Button type="submit" disabled={!text.trim() || busy} aria-label={t("Send")}><Send className="size-4" /></Button>
      </form>
    </Card>
  );
}

export function AiPage() {
  const { data } = useAiSettings();
  return (
    <div>
      <PageHeader title="AI Assistant" description="Configure how the assistant talks to your customers, then test it." />
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        {data ? <SettingsForm initial={data} /> : <Skeleton className="h-96" />}
        <TestChat />
      </div>
    </div>
  );
}
