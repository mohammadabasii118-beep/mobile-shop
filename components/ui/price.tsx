import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { discountPercent } from "@/lib/pricing";

interface PriceProps {
  value: number;
  oldValue?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  showDiscount?: boolean;
}

const sizes = { sm: "text-base", md: "text-lg", lg: "text-2xl md:text-3xl" } as const;

/** تنها راه نمایش قیمت — DESIGN.md §3 */
export function Price({ value, oldValue, size = "md", className, showDiscount = true }: PriceProps) {
  const pct = discountPercent(value, oldValue);
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className={cn("price", sizes[size])}>
        {formatNumber(value)}
        <span className="ms-1 text-[0.6em] font-medium text-muted">تومان</span>
      </span>
      {pct > 0 && (
        <>
          <s className="num text-sm text-muted decoration-discount/60">{formatNumber(oldValue!)}</s>
          {showDiscount && <span className="num text-sm font-bold text-discount">{formatNumber(pct)}٪-</span>}
        </>
      )}
    </div>
  );
}
