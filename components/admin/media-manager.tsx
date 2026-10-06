"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Film, Loader2, Star, Trash2 } from "lucide-react";
import { btnGhost, confirmAsk, toast, useApi } from "@/components/admin/kit";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

export interface MediaItem { id: string; type: "IMAGE" | "VIDEO"; url: string; alt: string | null; caption: string | null; sortOrder: number; isPrimary: boolean; fileSize: number | null; width: number | null; height: number | null }

const kb = (n: number | null) => (n ? `${Math.round(n / 1024).toLocaleString("fa-IR")} KB` : "");

/** Multi-image gallery + short videos for an existing product. Every action is an immediate API call (server keeps exactly one primary image). */
export function MediaManager({ productId, productName }: { productId: string; productName: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const base = `/api/admin/products/${productId}/media`;
  const { data: items, reload } = useApi<MediaItem[]>(base);

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    if (!r.ok) toast(r.error?.message ?? "خطا", "err");
    reload();
  };
  const upload = (type: "IMAGE" | "VIDEO", f: File | undefined) => {
    if (!f) return;
    void run(`up-${type}`, () => { const fd = new FormData(); fd.append("file", f); fd.append("type", type); fd.append("alt", productName); return api<MediaItem>("POST", base, fd); });
  };
  const move = (i: number, d: -1 | 1) => {
    if (!items) return; const a = [...items]; const j = i + d; if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j]!, a[i]!];
    void run("order", () => api("POST", `${base}/reorder`, { ids: a.map((m) => m.id) }));
  };
  const patch = (id: string, body: object) => run(`p-${id}`, () => api("PATCH", `${base}/${id}`, body));

  if (!items) return <p className="text-xs text-muted">در حال بارگذاری رسانه‌ها…</p>;
  return (
    <div data-testid="media-manager">
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((m, i) => (
          <div key={m.id} className="flex gap-2 rounded-lg border border-border p-2" data-testid="media-item" data-type={m.type} data-primary={m.isPrimary}>
            <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface-2">
              {m.type === "IMAGE" ? <img src={m.url} alt={m.alt ?? ""} className="size-full object-cover" /> : <Film className="size-8 text-muted" aria-label="ویدیو" />}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted">
                {m.isPrimary && <span className="rounded-full bg-primary/12 px-2 py-0.5 font-bold text-primary">تصویر اصلی</span>}
                <span>{m.type === "VIDEO" ? "ویدیو" : "تصویر"}</span><span>{kb(m.fileSize)}</span>{m.width && m.height ? <span dir="ltr">{m.width}×{m.height}</span> : null}
              </div>
              <input defaultValue={m.alt ?? ""} maxLength={160} placeholder="متن جایگزین (alt)" aria-label="متن جایگزین" className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs" onBlur={(e) => { if (e.target.value !== (m.alt ?? "")) void patch(m.id, { alt: e.target.value }); }} />
              <input defaultValue={m.caption ?? ""} maxLength={200} placeholder="عنوان/کپشن (اختیاری)" aria-label="کپشن" className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs" onBlur={(e) => { if (e.target.value !== (m.caption ?? "")) void patch(m.id, { caption: e.target.value }); }} />
              <div className="flex flex-wrap gap-1">
                {m.type === "IMAGE" && !m.isPrimary && <button type="button" className={cn(btnGhost, "h-7 px-2 text-[11px]")} onClick={() => void patch(m.id, { isPrimary: true })}><Star className="size-3.5" />اصلی کن</button>}
                <button type="button" className="grid size-7 cursor-pointer place-items-center rounded hover:bg-surface-2" onClick={() => move(i, -1)} aria-label="بالا"><ArrowUp className="size-4" /></button>
                <button type="button" className="grid size-7 cursor-pointer place-items-center rounded hover:bg-surface-2" onClick={() => move(i, 1)} aria-label="پایین"><ArrowDown className="size-4" /></button>
                <button type="button" className="grid size-7 cursor-pointer place-items-center rounded text-hot hover:bg-hot/10" aria-label="حذف" onClick={() => { if (confirmAsk("این رسانه حذف شود؟ (محصول حذف نمی‌شود)")) void run(`d-${m.id}`, () => api("DELETE", `${base}/${m.id}`)); }}><Trash2 className="size-4" /></button>
              </div>
            </div>
          </div>
        ))}
        {!items.length && <p className="text-xs text-muted sm:col-span-2">هنوز رسانه‌ای ندارد.</p>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className={cn(btnGhost, "h-9 cursor-pointer")}>{busy === "up-IMAGE" ? <Loader2 className="size-4 animate-spin" /> : "افزودن تصویر"}
          <input type="file" data-testid="media-add-image" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { upload("IMAGE", e.target.files?.[0]); e.target.value = ""; }} /></label>
        <label className={cn(btnGhost, "h-9 cursor-pointer")}>{busy === "up-VIDEO" ? <Loader2 className="size-4 animate-spin" /> : "افزودن ویدیو"}
          <input type="file" data-testid="media-add-video" accept="video/mp4,video/webm" className="sr-only" onChange={(e) => { upload("VIDEO", e.target.files?.[0]); e.target.value = ""; }} /></label>
        <span className="text-[11px] text-muted">تصویر JPG/PNG/WebP (حداکثر ۱۲ عدد، بزرگ‌تر از ۲۰۰۰ پیکسل کوچک می‌شود) · ویدیو MP4/WebM حداکثر ۲۵ مگابایت (حداکثر ۳ عدد)</span>
      </div>
    </div>
  );
}
