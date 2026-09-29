"use client";
import { useState } from "react";
import { adjustWalletBalance } from "@/lib/actions/wallet";

export default function WalletAdjustForm({ userId }: { userId: string }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save(sign: 1 | -1) {
    setError("");
    setSaved(false);
    const n = Number(amount);
    if (!Number.isInteger(n) || n <= 0) {
      setError("مبلغ معتبری وارد کنید");
      return;
    }
    setSaving(true);
    try {
      await adjustWalletBalance(userId, n * sign, reason);
      setAmount("");
      setReason("");
      setSaved(true);
    } catch (e: any) {
      setError(e?.message || "خطا در ثبت تغییر کیف پول");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="مبلغ (تومان)"
          className="flex-1 h-10 rounded-lg border line bg-transparent px-3 text-sm"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="دلیل تغییر (الزامی)"
          className="flex-1 h-10 rounded-lg border line bg-transparent px-3 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button onClick={() => save(1)} disabled={saving} className="flex-1 h-10 rounded-full text-white text-sm font-bold disabled:opacity-60" style={{ background: "#2f6f4e" }}>
          افزودن به کیف پول
        </button>
        <button onClick={() => save(-1)} disabled={saving} className="flex-1 h-10 rounded-full text-white text-sm font-bold disabled:opacity-60" style={{ background: "#a24e56" }}>
          کسر از کیف پول
        </button>
      </div>
      {error && <p className="text-xs" style={{ color: "#a24e56" }}>{error}</p>}
      {saved && <p className="text-xs" style={{ color: "#2f6f4e" }}>ثبت شد ✓</p>}
    </div>
  );
}
