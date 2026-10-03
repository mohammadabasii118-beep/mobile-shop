import { Star } from "lucide-react";
import { formatDecimal, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** ستارهٔ تکی + عدد: کم‌نویز (DESIGN.md §8) */
export function Rating({ value, count, className }: { value: number; count?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", className)} aria-label={`امتیاز ${formatDecimal(value)} از ۵`}>
      <Star className="size-4 fill-current" aria-hidden />
      <span className="num font-semibold">{formatDecimal(value)}</span>
      {count !== undefined && <span className="num text-muted">({formatNumber(count)})</span>}
    </span>
  );
}
