"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

interface N { id: string; event: string | null; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string }
const fmt = (d: string) => new Date(d).toLocaleString("fa-IR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

export function NotificationsList() {
  const [page, setPage] = useState(1);
  const [only, setOnly] = useState(false);
  const [data, setData] = useState<{ items: N[]; unread: number; pages: number } | null>(null);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    api<{ items: N[]; unread: number; pages: number }>("GET", `/api/notifications?page=${page}${only ? "&unread=1" : ""}`).then((r) => {
      if (!live) return;
      if (r.ok) { setData(r.data); setErr(""); } else setErr(r.error.message);
    });
    return () => { live = false; };
  }, [page, only, tick]);
  const mark = async (body: object) => { await api("POST", "/api/notifications", body); setTick((t) => t + 1); };

  if (err) return <p className="rounded-xl bg-hot/10 p-3 text-xs text-hot">{err}</p>;
  if (!data) return <p className="py-10 text-center text-xs text-muted">در حال بارگذاری…</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-[var(--primary)]" checked={only} onChange={(e) => { setOnly(e.target.checked); setPage(1); }} />فقط خوانده‌نشده‌ها</label>
        <button disabled={data.unread === 0} onClick={() => mark({ all: true })} className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-xs font-bold text-primary disabled:opacity-40"><CheckCheck className="size-4" />علامت‌گذاری همه به‌عنوان خوانده‌شده ({data.unread.toLocaleString("fa-IR")})</button>
      </div>
      {data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-primary/30 px-4 py-9 text-center"><span className="mx-auto grid size-12 place-items-center rounded-xl bg-primary/10 text-primary"><Bell className="size-6" /></span><p className="mt-3 text-xs text-muted">اعلانی وجود ندارد.</p></div>
      ) : (
        <ul className="space-y-2">
          {data.items.map((n) => (
            <li key={n.id} className={cn("rounded-2xl border p-3.5 text-[13px]", n.readAt ? "border-border bg-surface" : "border-primary/40 bg-primary/5")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><b className="block">{!n.readAt && <i className="me-1.5 inline-block size-2 rounded-full bg-primary align-middle" />}{n.title}</b>{n.body && <p className="mt-1 text-xs leading-6 text-muted">{n.body}</p>}
                  <span className="mt-1 block text-[11px] text-muted">{fmt(n.createdAt)}</span></div>
                <div className="flex shrink-0 flex-col items-end gap-1.5 text-[11px]">
                  {n.link && <Link href={n.link} onClick={() => !n.readAt && void api("POST", "/api/notifications", { ids: [n.id] })} className="font-bold text-primary">مشاهده</Link>}
                  <button onClick={() => mark({ ids: [n.id], unread: !!n.readAt })} className="cursor-pointer text-muted hover:text-primary">{n.readAt ? "خوانده‌نشده" : "خوانده شد"}</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data.pages > 1 && <div className="flex items-center justify-center gap-3 pt-2 text-xs"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="cursor-pointer rounded-lg bg-surface-2 px-3 py-1.5 disabled:opacity-40">قبلی</button><span>{page.toLocaleString("fa-IR")} از {data.pages.toLocaleString("fa-IR")}</span><button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="cursor-pointer rounded-lg bg-surface-2 px-3 py-1.5 disabled:opacity-40">بعدی</button></div>}
    </div>
  );
}
