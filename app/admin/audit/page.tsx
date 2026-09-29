import Link from "next/link";
import { db } from "@/lib/db";
import { Card, PageHead, Pill } from "@/components/admin/kit";
import { requireAdminPage } from "@/lib/server/admin/page";

const fmt = (d: Date) => d.toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "medium" });
const PER = 40;

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; entity?: string; q?: string }> }) {
  await requireAdminPage("audit.read", "/admin/audit");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = { ...(sp.entity ? { entity: sp.entity } : {}), ...(sp.q ? { OR: [{ action: { contains: sp.q, mode: "insensitive" as const } }, { entityId: { contains: sp.q } }] } : {}) };
  const [rows, total, entities] = await Promise.all([
    db.adminLog.findMany({ where, orderBy: { createdAt: "desc" }, take: PER, skip: (page - 1) * PER, include: { admin: { select: { displayName: true, phone: true } } } }),
    db.adminLog.count({ where }),
    db.adminLog.groupBy({ by: ["entity"], _count: true, orderBy: { entity: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER));
  const qs = (p: number) => `?${new URLSearchParams({ ...(sp.entity ? { entity: sp.entity } : {}), ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`;
  return (
    <>
      <PageHead title="لاگ عملیات مدیریتی" sub="فقط‌خواندنی و غیرقابل ویرایش (در سطح پایگاه‌داده نیز محافظت شده است)." />
      <form className="mb-3 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="جستجو در عملیات یا شناسه…" className="h-10 w-64 rounded-md border border-border bg-surface px-3 text-sm" />
        <select name="entity" defaultValue={sp.entity ?? ""} className="h-10 rounded-md border border-border bg-surface px-3 text-sm"><option value="">همه بخش‌ها</option>{entities.map((e) => <option key={e.entity} value={e.entity}>{e.entity} ({e._count.toLocaleString("fa-IR")})</option>)}</select>
        <button className="h-10 cursor-pointer rounded-md bg-primary px-4 text-sm font-bold text-primary-fg">فیلتر</button>
      </form>
      <div className="space-y-2">
        {rows.length === 0 && <Card className="py-10 text-center text-sm text-muted">رکوردی نیست.</Card>}
        {rows.map((l) => (
          <Card key={l.id} className="p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2"><Pill tone="info">{l.action}</Pill><span className="text-xs text-muted">{l.entity}{l.entityId ? ` · ${l.entityId.slice(0, 10)}` : ""}</span></span><span className="text-xs text-muted">{l.admin?.displayName ?? l.admin?.phone ?? "—"} · {fmt(l.createdAt)}{l.ip ? ` · ${l.ip}` : ""}</span></div>
            {(l.oldValue || l.newValue) && (
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {l.oldValue != null && <pre dir="ltr" className="max-h-40 overflow-auto rounded-lg bg-error/5 p-2 text-start text-[11px] leading-5">{JSON.stringify(l.oldValue, null, 1)}</pre>}
                {l.newValue != null && <pre dir="ltr" className="max-h-40 overflow-auto rounded-lg bg-success/5 p-2 text-start text-[11px] leading-5">{JSON.stringify(l.newValue, null, 1)}</pre>}
              </div>
            )}
          </Card>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted"><span>{total.toLocaleString("fa-IR")} رکورد</span><span className="flex items-center gap-3">{page > 1 && <Link className="font-bold text-primary" href={qs(page - 1)}>قبلی</Link>}<span>{page.toLocaleString("fa-IR")} از {pages.toLocaleString("fa-IR")}</span>{page < pages && <Link className="font-bold text-primary" href={qs(page + 1)}>بعدی</Link>}</span></div>
    </>
  );
}
