import { cn, formatPrice } from "@/lib/utils";

export function Price({ value, old, size = "md", className }: { value: number; old?: number; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <div className={cn("flex flex-col", className)}>
      {old ? (
        <span className={cn("text-neutral-500 line-through decoration-primary/60", size === "lg" ? "text-base" : "text-xs")}>
          {formatPrice(old)}
        </span>
      ) : null}
      <span className="flex items-baseline gap-1">
        <span className={cn("font-extrabold tracking-tight text-neutral-950", size === "sm" && "text-[15px]", size === "md" && "text-lg", size === "lg" && "text-3xl")}>
          {formatPrice(value)}
        </span>
        <span className={cn("font-medium text-neutral-600", size === "lg" ? "text-sm" : "text-[11px]")}>تومان</span>
      </span>
    </div>
  );
}
