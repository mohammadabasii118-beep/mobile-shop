import Icon from "./Icon";
import { ORDER_STATUS_LABEL } from "@/lib/orderStatus";

export type OrderStatusHistoryEntry = {
  id: string;
  status: string;
  note: string | null;
  createdAt: string; // ISO
};

/**
 * Renders the order's REAL status history — every entry here is a row
 * that was actually written to the database at the moment the order's
 * status genuinely changed (see lib/orderStatusHistory.ts). There is no
 * synthetic/placeholder stage: an order that hasn't reached a stage yet
 * simply has no entry for it, and nothing here is invented for display.
 */
export default function OrderTimeline({ history }: { history: OrderStatusHistoryEntry[] }) {
  if (history.length === 0) return null;

  return (
    <div className="surface border line rounded-2xl p-5">
      <h2 className="font-bold text-sm mb-4">روند سفارش</h2>
      <ol className="flex flex-col gap-0">
        {history.map((h, i) => {
          const isLast = i === history.length - 1;
          const isCanceled = h.status === "CANCELED";
          return (
            <li key={h.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: isCanceled ? "#f6eae6" : isLast ? "var(--ink)" : "var(--surface-2)",
                    color: isCanceled ? "#a24e56" : isLast ? "var(--ink-contrast, #fff)" : "var(--muted)",
                  }}
                >
                  <Icon name={isCanceled ? "x" : "check"} className="w-4 h-4" />
                </span>
                {i < history.length - 1 && <span className="w-px flex-1 my-1" style={{ background: "var(--line)" }} />}
              </div>
              <div className={isLast ? "" : "pb-5"}>
                <p className="text-sm font-medium">{ORDER_STATUS_LABEL[h.status] || h.status}</p>
                {h.note && <p className="text-xs muted mt-0.5">{h.note}</p>}
                <p className="text-xs muted mt-0.5">{new Date(h.createdAt).toLocaleString("fa-IR")}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
