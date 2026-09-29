"use client";
import { useState } from "react";
import { adminReplyToTicket, closeTicket } from "@/lib/actions/support";

export default function AdminTicketActions({ ticketId, status }: { ticketId: string; status: string }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="mt-4">
      <form
        action={async (fd) => {
          setSaving(true);
          setError("");
          try {
            await adminReplyToTicket(ticketId, fd);
          } catch (e: any) {
            setError(e?.message || "خطا در ارسال پاسخ");
          } finally {
            setSaving(false);
          }
        }}
        className="flex flex-col gap-2"
      >
        <textarea name="body" required rows={3} placeholder="پاسخ به مشتری…" className="w-full rounded-lg border line bg-transparent px-3 py-2 text-sm" />
        {error && <p className="text-xs" style={{ color: "#a24e56" }}>{error}</p>}
        <div className="flex justify-between items-center">
          <button disabled={saving} className="px-6 h-10 rounded-full text-white text-sm font-bold disabled:opacity-60" style={{ background: "var(--ink)" }}>
            {saving ? "در حال ارسال…" : "ارسال پاسخ"}
          </button>
          {status !== "CLOSED" && (
            <button
              type="button"
              onClick={() => { if (confirm("این تیکت بسته شود؟")) closeTicket(ticketId); }}
              className="px-5 h-10 rounded-full text-xs font-bold"
              style={{ background: "#f6eae6", color: "#a24e56" }}
            >
              بستن تیکت
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
