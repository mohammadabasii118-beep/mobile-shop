import type { StockStatus } from "@/data/products";
import { cn, toFa } from "@/lib/utils";

const MAP: Record<StockStatus, { label: string; dot: string; text: string }> = {
  "in-stock": { label: "موجود در انبار", dot: "bg-emerald-500", text: "text-emerald-700" },
  "low-stock": { label: "تعداد محدود", dot: "bg-amber-500", text: "text-amber-700" },
  "out-of-stock": { label: "ناموجود", dot: "bg-neutral-400", text: "text-neutral-500" },
};

export function StockBadge({ status, qty, className }: { status: StockStatus; qty?: number; className?: string }) {
  const s = MAP[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", s.text, className)}>
      <span className="relative flex size-2">
        {status !== "out-of-stock" && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", s.dot)} />}
        <span className={cn("relative inline-flex size-2 rounded-full", s.dot)} />
      </span>
      {s.label}
      {status === "low-stock" && qty ? ` (${toFa(qty)} عدد)` : null}
    </span>
  );
}
