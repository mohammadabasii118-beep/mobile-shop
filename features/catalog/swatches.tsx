"use client";

import { cn } from "@/lib/utils";
import type { ProductColor } from "@/types/product";

interface Props {
  colors: ProductColor[];
  value: string;
  onChange: (id: string) => void;
  size?: "sm" | "md";
  label?: string;
}

/** انتخاب رنگ؛ ناحیهٔ لمس ≥ ۴۴px بدون بزرگ‌شدن ظاهر (DESIGN.md §4) */
export function Swatches({ colors, value, onChange, size = "sm", label = "رنگ" }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1.5">
      {colors.map((c) => {
        const on = c.id === value;
        return (
          <button
            key={c.id}
            role="radio"
            aria-checked={on}
            aria-label={c.name}
            title={c.name}
            onClick={(e) => { e.preventDefault(); onChange(c.id); }}
            className={cn(
              "relative grid place-items-center rounded-full after:absolute after:-inset-2 after:content-['']",
              size === "sm" ? "size-6" : "size-9",
              on ? "shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--fg)]" : "shadow-[inset_0_0_0_1px_var(--line)]",
            )}
          >
            <span className={cn("rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]", size === "sm" ? "size-[18px]" : "size-7")} style={{ background: c.hex }} />
          </button>
        );
      })}
    </div>
  );
}
