"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTicket } from "@/lib/actions/support";

export default function NewTicketPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setSaving(true);
    setError("");
    try {
      const result = await createTicket(formData);
      router.push(`/account/support/${result.id}`);
    } catch (e: any) {
      setError(e?.message || "خطا در ثبت تیکت");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 md:px-8 py-10">
      <h1 className="text-2xl font-extrabold mb-6">تیکت پشتیبانی جدید</h1>
      <form action={submit} className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium block mb-1">موضوع</label>
          <input name="subject" required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">پیام شما</label>
          <textarea name="body" rows={6} required className="w-full rounded-lg border line bg-transparent px-3 py-2 text-sm" />
        </div>
        {error && <p className="text-sm" style={{ color: "#a24e56" }}>{error}</p>}
        <button disabled={saving} className="h-11 rounded-full text-white font-bold disabled:opacity-60" style={{ background: "var(--ink)" }}>
          {saving ? "در حال ارسال…" : "ارسال تیکت"}
        </button>
      </form>
    </div>
  );
}
