"use client";
import type { ReactNode } from "react";
import { useT } from "@/i18n/provider";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  const t = useT();
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t(title)}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{t(description)}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
