"use client";
import { useState } from "react";
import { Empty, ErrorBox, Pager, Spinner, Table, Td, fmtDate, fmtNum, useApi } from "@/components/admin/kit";

type Kind = "wallet" | "loyalty" | "support";
interface Row { id: string; balance?: number; points?: number; number?: number; subject?: string; status?: string; updatedAt?: string; user: { displayName: string | null; phone: string }; transactions?: { id: string; type: string; amount?: number; points?: number; description: string | null; createdAt: string }[]; _count?: { messages: number } }

export function ReadonlyList({ kind }: { kind: Kind }) {
  const [page, setPage] = useState(1);
  const { data, error, loading } = useApi<{ items: Row[]; total: number; page: number; pages: number }>(`/api/admin/${kind}?page=${page}`);
  if (error) return <ErrorBox message={error} />;
  if (loading) return <Spinner />;
  if (!data?.items.length) return <Empty text={kind === "support" ? "هنوز تیکتی ثبت نشده است." : "موردی نیست."} />;
  const head = kind === "support" ? ["شماره", "کاربر", "موضوع", "وضعیت", "پیام‌ها", "آخرین به‌روزرسانی"] : ["کاربر", kind === "wallet" ? "موجودی" : "امتیاز", "آخرین تراکنش‌ها"];
  return (
    <>
      <Table head={head}>
        {data.items.map((r) => kind === "support"
          ? <tr key={r.id}><Td>#{fmtNum(r.number)}</Td><Td>{r.user.displayName ?? r.user.phone}</Td><Td>{r.subject}</Td><Td>{r.status}</Td><Td>{fmtNum(r._count?.messages)}</Td><Td className="text-xs">{fmtDate(r.updatedAt)}</Td></tr>
          : <tr key={r.id}><Td>{r.user.displayName ?? r.user.phone}<div dir="ltr" className="text-start text-[11px] text-muted">{r.user.phone}</div></Td><Td className="font-black">{fmtNum(kind === "wallet" ? r.balance : r.points)}{kind === "wallet" ? " تومان" : ""}</Td><Td className="text-xs text-muted">{r.transactions?.map((t) => `${t.description ?? t.type} (${fmtNum(t.amount ?? t.points)})`).join(" · ") || "—"}</Td></tr>)}
      </Table>
      <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
    </>
  );
}
