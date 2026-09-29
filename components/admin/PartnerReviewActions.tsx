"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewPartnerApplication } from "@/lib/actions/partners";

export default function PartnerReviewActions({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  async function approve() {
    setLoading("approve");
    setError("");
    try {
      await reviewPartnerApplication(applicationId, "APPROVE");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "خطا در ثبت تأیید");
    }
    setLoading(null);
  }

  async function reject() {
    setLoading("reject");
    setError("");
    try {
      await reviewPartnerApplication(applicationId, "REJECT", reason.trim() || undefined);
      setRejecting(false);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "خطا در ثبت رد");
    }
    setLoading(null);
  }

  if (rejecting) {
    return (
      <div className="flex flex-col gap-2 min-w-[220px]">
        <input
          autoFocus
          placeholder="دلیل رد (اختیاری)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="h-9 rounded-lg border line bg-transparent px-2 text-sm outline-none"
        />
        <div className="flex gap-2">
          <button onClick={reject} disabled={loading === "reject"} className="flex-1 h-9 rounded-full text-white text-xs font-bold disabled:opacity-60" style={{ background: "#a24e56" }}>
            {loading === "reject" ? "..." : "ثبت رد"}
          </button>
          <button onClick={() => setRejecting(false)} className="h-9 px-3 rounded-full border line text-xs">انصراف</button>
        </div>
        {error && <p className="text-xs" style={{ color: "#a24e56" }}>{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <button onClick={approve} disabled={loading !== null} className="px-4 h-9 rounded-full text-white text-xs font-bold disabled:opacity-60" style={{ background: "var(--ink)" }}>
          {loading === "approve" ? "..." : "تأیید همکاری"}
        </button>
        <button onClick={() => setRejecting(true)} disabled={loading !== null} className="px-4 h-9 rounded-full border text-xs" style={{ borderColor: "#a24e56", color: "#a24e56" }}>
          رد درخواست
        </button>
      </div>
      {error && <p className="text-xs" style={{ color: "#a24e56" }}>{error}</p>}
    </div>
  );
}
