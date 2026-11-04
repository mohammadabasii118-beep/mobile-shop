import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-xl border border-input bg-background px-4 text-sm transition-[border,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-neutral-950 focus-visible:ring-[3px] focus-visible:ring-neutral-950/10 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
