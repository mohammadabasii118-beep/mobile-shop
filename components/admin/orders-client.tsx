"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Empty, ErrorBox, ORDER_LABEL, PAY_LABEL, Pager, Pill, Spinner, StatusPill, Table, Td, fmtDate, fmtId, fmtNum, fmtToman, inputCls, useApi } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

interface Row { id: string; number: number; type: string; status: string; paymentStatus: string; customerName: string; customerPhone: string; total: number; createdAt: string; _count: { items: number } }

export function OrdersClient({ initial }: { initial: { status?: string; paymentStatus?: string } }) {
  const [q, setQ] = useState(""); const [page, setPage] = useState(1); const [status, setStatus] = useState(initial.status ?? ""); const [pay, setPay] = useState(initial.paymentStatus ?? ""); const [type, setType] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const url = useMemo(() => { const u = new URLSearchParams({ page: String(page) }); if (q) u.set("q", q); if (status) u.set("status", status); if (pay) u.set("paymentStatus", pay); if (type) u.set("type", type); if (from) u.set("from", from); if (to) u.set("to", to); return `/api/admin/orders?${u}`; }, [q, page, status, pay, type, from, to]);
  const { data, error, loading } = useApi<{ items: Row[]; total: number; page: number; pages: number }>(url);
  const r = (f: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { f(e.target.value); setPage(1); };
  return (
    <div>
      <div className="mb-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <input className={inputCls} placeholder="شماره سفارش / نام / موبایل" value={q} onChange={r(setQ)} aria-label="جستجو" />
        <select className={inputCls} value={status} onChange={r(setStatus)} aria-label="وضعیت سفارش"><option value="">وضعیت: همه</option>{Object.entries(ORDER_LABEL).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className={inputCls} value={pay} onChange={r(setPay)} aria-label="وضعیت پرداخت"><option value="">پرداخت: همه</option>{Object.entries(PAY_LABEL).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className={inputCls} value={type} onChange={r(setType)} aria-label="نوع"><option value="">نوع: همه</option><option value="RETAIL">خرده</option><option value="WHOLESALE">عمده</option></select>
        <input type="date" className={inputCls} value={from} onChange={r(setFrom)} aria-label="از تاریخ" />
        <input type="date" className={inputCls} value={to} onChange={r(setTo)} aria-label="تا تاریخ" />
      </div>
      {error ? <ErrorBox message={error} /> : loading ? <Spinner /> : !data?.items.length ? <Empty /> : (
        <>
          <Table head={["سفارش", "مشتری", "تاریخ", "نوع", "اقلام", "مبلغ", "پرداخت", "وضعیت"]}>
            {data.items.map((o) => (
              <tr key={o.id} className="hover:bg-surface-2/60">
                <Td><Link href={`/admin/orders/${o.number}`} className="font-black text-primary">#{fmtId(o.number)}</Link></Td>
                <Td>{o.customerName}<div dir="ltr" className="text-start text-[11px] text-muted">{o.customerPhone}</div></Td>
                <Td className="text-xs">{fmtDate(o.createdAt)}</Td>
                <Td><Pill tone={o.type === "WHOLESALE" ? "warn" : "mute"}>{o.type === "WHOLESALE" ? "عمده" : "خرده"}</Pill></Td>
                <Td>{fmtNum(o._count.items)}</Td><Td className="font-bold">{fmtToman(o.total)}</Td>
                <Td><StatusPill map={PAY_LABEL} value={o.paymentStatus} /></Td><Td><StatusPill map={ORDER_LABEL} value={o.status} /></Td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
      <span className={cn("hidden")} />
    </div>
  );
}
