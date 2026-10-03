"use client";

import { Suspense, useRef, type ReactNode } from "react";
import { useCanUse3D, type Capability } from "@/hooks/use-can-use-3d";
import { useNearViewport } from "@/hooks/use-near-viewport";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  /** تصویر دو‌بعدی: پیش از آماده‌شدن 3D، بیرون viewport، و وقتی 3D ممکن نیست */
  fallback: ReactNode;
  children: (cap: Capability) => ReactNode;
  label: string;
}

/**
 * پوستهٔ مشترک همهٔ Canvasها (DESIGN.md §9):
 * فقط وقتی نزدیک viewport است Canvas mount می‌شود ⇒ همیشه حداکثر یک Canvas فعال.
 */
export function CanvasShell({ className, fallback, children, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useNearViewport(ref);
  const cap = useCanUse3D();
  const active = near && cap.status === "yes";

  return (
    <div ref={ref} className={cn("relative", className)} role="group" aria-roledescription="نمایشگر محصول" aria-label={label}>
      {active ? (
        <ErrorBoundary fallback={fallback}>
          <Suspense fallback={fallback}>{children(cap)}</Suspense>
        </ErrorBoundary>
      ) : (
        fallback
      )}
    </div>
  );
}
