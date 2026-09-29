"use client";
import { useState } from "react";
import { updateOrderTracking } from "@/lib/actions/orders";

export default function OrderTrackingForm({
  orderId,
  initialCarrier,
  initialNumber,
}: {
  orderId: string;
  initialCarrier: string | null;
  initialNumber: string | null;
}) {
  const [carrier, setCarrier] = useState(initialCarrier || "");
  const [number, setNumber] = useState(initialNumber || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    const fd = new FormData();
    fd.set("trackingCarrier", carrier);
    fd.set("trackingNumber", number);
    await updateOrderTracking(orderId, fd);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <input
        value={carrier}
        onChange={(e) => setCarrier(e.target.value)}
        placeholder="نام شرکت پستی (مثلاً پست پیشتاز، تیپاکس)"
        className="flex-1 h-10 rounded-lg border line bg-transparent px-3 text-sm"
      />
      <input
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="کد رهگیری مرسوله"
        className="flex-1 h-10 rounded-lg border line bg-transparent px-3 text-sm"
      />
      <button
        onClick={save}
        disabled={saving}
        className="px-5 h-10 rounded-full text-white text-sm font-bold disabled:opacity-60 shrink-0"
        style={{ background: "var(--ink)" }}
      >
        {saving ? "در حال ذخیره…" : saved ? "ذخیره شد ✓" : "ذخیره اطلاعات رهگیری"}
      </button>
    </div>
  );
}
