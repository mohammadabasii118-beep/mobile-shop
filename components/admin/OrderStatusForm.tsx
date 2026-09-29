"use client";
import { useState } from "react";
import { updateOrderStatus } from "@/lib/actions/orders";
import type { OrderStatus } from "@prisma/client";

const options: { value: OrderStatus; label: string }[] = [
  { value: "PENDING_PAYMENT", label: "در انتظار پرداخت" },
  { value: "PAID", label: "پرداخت شده" },
  { value: "PROCESSING", label: "در حال آماده‌سازی" },
  { value: "SHIPPED", label: "ارسال شده" },
  { value: "DELIVERED", label: "تحویل داده شده" },
  { value: "CANCELED", label: "لغو شده" },
];

export default function OrderStatusForm({ orderId, current }: { orderId: string; current: OrderStatus }) {
  const [status, setStatus] = useState(current);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await updateOrderStatus(orderId, status);
    setSaving(false);
  }

  return (
    <div className="flex items-center gap-3">
      <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} className="h-10 rounded-lg border line bg-transparent px-3 text-sm">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button onClick={save} disabled={saving} className="px-5 h-10 rounded-full text-white text-sm font-bold disabled:opacity-60" style={{ background: "var(--ink)" }}>
        {saving ? "در حال ذخیره…" : "به‌روزرسانی وضعیت"}
      </button>
    </div>
  );
}
