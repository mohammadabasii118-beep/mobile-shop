"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Empty, ErrorBox, Pager, Pill, Spinner, Table, Td, fmtDate, fmtNum, inputCls, useApi } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

interface Row { id: string; phone: string | null; email: string | null; displayName: string | null; firstName: string | null; lastName: string | null; isActive: boolean; createdAt: string; roles: { key: string; name: string }[]; _count: { orders: number } }

export function CustomersClient() {
  const [q, setQ] = useState(""); const [page, setPage] = useState(1); const [role, setRole] = useState(""); const [act, setAct] = useState("");
  const url = useMemo(() => { const u = new URLSearchParams({ page: String(page), roles: "1" }); if (q) u.set("q", q); if (role) u.set("role", role); if (act) u.set("isActive", act); return `/api/admin/customers?${u}`; }, [q, page, role, act]);
  const { data, error, loading } = useApi<{ items: Row[]; total: number; page: number; pages: number; roles: { key: string; name: string }[] }>(url);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input className={cn(inputCls, "max-w-64")} placeholder="نام، موبایل یا ایمیل…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="جستجو" />
        <select className={cn(inputCls, "w-auto")} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="نقش"><option value="">نقش: همه</option>{data?.roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select>
        <select className={cn(inputCls, "w-auto")} value={act} onChange={(e) => { setAct(e.target.value); setPage(1); }} aria-label="وضعیت"><option value="">وضعیت: همه</option><option value="true">فعال</option><option value="false">غیرفعال</option></select>
      </div>
      {error ? <ErrorBox message={error} /> : loading && !data ? <Spinner /> : !data?.items.length ? <Empty /> : (
        <>
          <Table head={["کاربر", "موبایل", "نقش‌ها", "سفارش‌ها", "عضویت", "وضعیت"]}>
            {data.items.map((u) => <tr key={u.id} className="hover:bg-surface-2/60"><Td><Link href={`/admin/customers/${u.id}`} className="font-bold hover:text-primary">{u.displayName ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || "—")}</Link></Td><Td><span dir="ltr">{u.phone ?? u.email ?? "—"}</span></Td><Td><span className="flex flex-wrap gap-1">{u.roles.map((r) => <Pill key={r.key} tone={r.key === "wholesale_partner" ? "warn" : "mute"}>{r.name}</Pill>)}</span></Td><Td>{fmtNum(u._count.orders)}</Td><Td className="text-xs">{fmtDate(u.createdAt)}</Td><Td><Pill tone={u.isActive ? "ok" : "bad"}>{u.isActive ? "فعال" : "غیرفعال"}</Pill></Td></tr>)}
          </Table>
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
