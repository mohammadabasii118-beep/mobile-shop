"use client";
import { useState } from "react";
import { customerReplyToTicket } from "@/lib/actions/support";

export default function CustomerReplyForm({ ticketId }: { ticketId: string }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      action={async (fd) => {
        setSaving(true);
        setError("");
        try {
          await customerReplyToTicket(ticketId, fd);
        } catch (e: any) {
          setError(e?.message || "خطا در ارسال پاسخ");
        } finally {
          setSaving(false);
        }
      }}
      className="flex flex-col gap-2 mt-4"
    >
      <textarea name="body" required rows={3} placeholder="پاسخ خود را بنویسید…" className="w-full rounded-lg border line bg-transparent px-3 py-2 text-sm" />
      {error && <p className="text-xs" style={{ color: "#a24e56" }}>{error}</p>}
      <button disabled={saving} className="self-end px-6 h-10 rounded-full text-white text-sm font-bold disabled:opacity-60" style={{ background: "var(--ink)" }}>
        {saving ? "در حال ارسال…" : "ارسال پاسخ"}
      </button>
    </form>
  );
}
