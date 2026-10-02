import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/provider";

export interface Column<T> {
  key: string;
  label: string;
  cell: (row: T) => ReactNode;
  /** Shown as the card title on mobile. */
  primary?: boolean;
  className?: string;
}

/** Table on md+, stacked cards on mobile — one column definition for both. */
export function DataTable<T>({ columns, rows, rowKey, onRowClick }: { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void }) {
  const t = useT();
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const rest = columns.filter((c) => c !== primary);
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-start text-xs text-muted-foreground">
              {columns.map((c) => <th key={c.key} className={cn("px-5 py-3 font-medium whitespace-nowrap", c.className)}>{t(c.label)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={rowKey(r)} onClick={() => onRowClick?.(r)} className={cn("hover:bg-muted/50", onRowClick && "cursor-pointer")}>
                {columns.map((c) => <td key={c.key} className={cn("px-5 py-3 align-middle", c.className)}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} onClick={() => onRowClick?.(r)} className="space-y-2 p-4">
            <div className="font-medium">{primary.cell(r)}</div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {rest.map((c) => (
                <div key={c.key}><dt className="text-muted-foreground">{t(c.label)}</dt><dd className="mt-0.5 text-sm">{c.cell(r)}</dd></div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
