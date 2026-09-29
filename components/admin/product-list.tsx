"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Empty, ErrorBox, Pager, Pill, Spinner, Table, Td, btnPrimary, fmtToman, fmtNum, inputCls, useApi } from "@/components/admin/kit";
import type { Opt } from "@/components/admin/resource-manager";
import { cn } from "@/lib/utils";

interface Row { id: string; name: string; sku: string; slug: string; isActive: boolean; retailPrice: number; retailDiscount: number; wholesalePrice: number | null; stock: number; variantCount: number; category: { name: string }; brand: { name: string } | null; images: { url: string }[] }

export function ProductList({ categories, brands, canWrite }: { categories: Opt[]; brands: Opt[]; canWrite: boolean }) {
  const [q, setQ] = useState(""); const [page, setPage] = useState(1); const [cat, setCat] = useState(""); const [brand, setBrand] = useState(""); const [act, setAct] = useState(""); const [low, setLow] = useState(false);
  const url = useMemo(() => { const u = new URLSearchParams({ page: String(page) }); if (q) u.set("q", q); if (cat) u.set("categoryId", cat); if (brand) u.set("brandId", brand); if (act) u.set("isActive", act); if (low) u.set("low", "1"); return `/api/admin/products?${u}`; }, [q, page, cat, brand, act, low]);
  const { data, error, loading } = useApi<{ items: Row[]; total: number; page: number; pages: number }>(url);
  const reset = <T,>(f: (v: T) => void) => (v: T) => { f(v); setPage(1); };
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className={cn(inputCls, "max-w-60")} placeholder="نام، SKU یا اسلاگ…" value={q} onChange={(e) => reset(setQ)(e.target.value)} aria-label="جستجو" />
        <select className={cn(inputCls, "w-auto")} value={cat} onChange={(e) => reset(setCat)(e.target.value)} aria-label="دسته"><option value="">دسته: همه</option>{categories.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        <select className={cn(inputCls, "w-auto")} value={brand} onChange={(e) => reset(setBrand)(e.target.value)} aria-label="برند"><option value="">برند: همه</option>{brands.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        <select className={cn(inputCls, "w-auto")} value={act} onChange={(e) => reset(setAct)(e.target.value)} aria-label="وضعیت"><option value="">وضعیت: همه</option><option value="true">فعال</option><option value="false">غیرفعال</option></select>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={low} onChange={(e) => reset(setLow)(e.target.checked)} className="accent-[var(--primary)]" />کم‌موجودی</label>
        {canWrite && <Link href="/admin/products/new" className={cn(btnPrimary, "ms-auto")}><Plus className="size-4" />محصول جدید</Link>}
      </div>
      {error ? <ErrorBox message={error} /> : loading ? <Spinner /> : !data?.items.length ? <Empty /> : (
        <>
          <Table head={["", "محصول", "دسته / برند", "قیمت خرده", "قیمت عمده", "موجودی", "وضعیت", ""]}>
            {data.items.map((p) => (
              <tr key={p.id} className="hover:bg-surface-2/60">
                <Td>{p.images[0] ? <img src={p.images[0].url} alt="" className="size-10 rounded-md object-cover" /> : <span className="grid size-10 place-items-center rounded-md bg-surface-2 text-[9px] text-muted">—</span>}</Td>
                <Td><Link href={`/admin/products/${p.id}`} className="font-bold hover:text-primary">{p.name}</Link><div dir="ltr" className="text-start text-[11px] text-muted">{p.sku}</div></Td>
                <Td className="text-xs">{p.category.name}<div className="text-muted">{p.brand?.name ?? "—"}</div></Td>
                <Td>{fmtToman(p.retailPrice - p.retailDiscount)}{p.retailDiscount > 0 && <div className="text-[11px] text-muted line-through">{fmtToman(p.retailPrice)}</div>}</Td>
                <Td>{p.wholesalePrice != null ? fmtToman(p.wholesalePrice) : "—"}</Td>
                <Td><Pill tone={p.stock === 0 ? "bad" : p.stock <= 5 ? "warn" : "ok"}>{fmtNum(p.stock)}</Pill><span className="ms-1 text-[11px] text-muted">({fmtNum(p.variantCount)} تنوع)</span></Td>
                <Td><Pill tone={p.isActive ? "ok" : "mute"}>{p.isActive ? "فعال" : "غیرفعال"}</Pill></Td>
                <Td className="text-end"><Link href={`/admin/products/${p.id}`} className="inline-grid size-8 place-items-center rounded-md hover:bg-primary/10 hover:text-primary" aria-label="ویرایش"><Pencil className="size-4" /></Link></Td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
