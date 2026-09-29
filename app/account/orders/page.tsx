import type { Metadata } from "next";
import { AccountShell } from "@/components/account-shell";

export const metadata: Metadata = { title: "سفارش‌های من | CaseLine" };

export default function OrdersPage() {
  return (
    <AccountShell active="orders">
      <section data-orders-root>
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-black">سفارش‌های در جریان<span data-orders-count className="grid size-6 place-items-center rounded-full bg-surface-2 text-[11px] text-muted">۰</span></h2>
        <div data-orders-active className="space-y-3" />
        <div data-orders-done className="mt-4 rounded-2xl border border-dashed border-primary/30 px-4 py-9 text-center text-xs text-muted">سفارش تمام‌شده‌ای ندارید.</div>
      </section>
    </AccountShell>
  );
}
