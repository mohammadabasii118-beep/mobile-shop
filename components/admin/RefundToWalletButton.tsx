"use client";
import { useState } from "react";
import { refundOrderToWallet } from "@/lib/actions/wallet";

export default function RefundToWalletButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function run() {
    if (!confirm("مبلغ کامل این سفارش به کیف پول مشتری بازگردانده و سفارش لغو می‌شود. ادامه می‌دهید؟")) return;
    setLoading(true);
    setError("");
    try {
      await refundOrderToWallet(orderId);
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "خطا در بازگشت وجه");
    } finally {
      setLoading(false);
    }
  }

  if (done) return <p className="text-xs" style={{ color: "#2f6f4e" }}>وجه با موفقیت به کیف پول مشتری بازگشت داده شد.</p>;

  return (
    <div>
      <button onClick={run} disabled={loading} className="px-4 h-9 rounded-full text-xs font-bold disabled:opacity-60" style={{ background: "#f6eae6", color: "#a24e56" }}>
        {loading ? "در حال پردازش…" : "لغو سفارش و بازگشت وجه به کیف پول"}
      </button>
      {error && <p className="text-xs mt-1" style={{ color: "#a24e56" }}>{error}</p>}
    </div>
  );
}
