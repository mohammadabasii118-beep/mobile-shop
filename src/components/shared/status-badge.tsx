import { Badge, type Tone } from "@/components/ui/badge";
import { useT } from "@/i18n/provider";

const MAP: Record<string, { tone: Tone; label?: string }> = {
  published: { tone: "success" }, active: { tone: "success" }, connected: { tone: "success" }, success: { tone: "success" },
  replied: { tone: "success" }, resolved: { tone: "success" }, verified: { tone: "success" },
  scheduled: { tone: "info" }, new: { tone: "info" }, info: { tone: "info" }, processing: { tone: "info" },
  paused: { tone: "neutral" }, ignored: { tone: "neutral" }, draft: { tone: "neutral" },
  failed: { tone: "danger" }, error: { tone: "danger" }, out_of_stock: { tone: "danger", label: "Out of stock" }, disconnected: { tone: "danger" },
  warning: { tone: "warning" }, pending: { tone: "warning" },
};

export function StatusBadge({ status }: { status: string }) {
  const t = useT();
  const m = MAP[status] ?? { tone: "neutral" as Tone };
  return <Badge tone={m.tone} dot>{t(m.label ?? status.charAt(0).toUpperCase() + status.slice(1))}</Badge>;
}

const SOURCE: Record<string, { tone: Tone; label: string }> = {
  telegram: { tone: "info", label: "Telegram" }, manual: { tone: "neutral", label: "Manual" }, ai: { tone: "primary", label: "AI" },
};
export function SourceBadge({ source }: { source: string }) {
  const t = useT();
  const s = SOURCE[source] ?? SOURCE.manual;
  return <Badge tone={s.tone}>{t(s.label)}</Badge>;
}
