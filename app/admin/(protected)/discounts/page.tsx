import Link from "next/link";
import { db } from "@/lib/db";
import { fa } from "@/lib/format";
import { deleteDiscount } from "@/lib/actions/discounts";

export default async function AdminDiscountsPage() {
  const discounts = await db.discount.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold">کدهای تخفیف</h1>
        <Link href="/admin/discounts/new" className="px-5 h-10 leading-[40px] rounded-full text-white text-sm font-bold" style={{ background: "var(--ink)" }}>+ کد جدید</Link>
      </div>
      <div className="surface border line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="surface2 text-xs muted">
            <tr>
              <th className="p-3 text-right">کد</th>
              <th className="p-3 text-right">نوع</th>
              <th className="p-3 text-right">مقدار</th>
              <th className="p-3 text-right">استفاده‌شده</th>
              <th className="p-3 text-right">وضعیت</th>
              <th className="p-3 text-right">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {discounts.map((d) => (
              <tr key={d.id} className="border-t line">
                <td className="p-3 font-mono">{d.code}</td>
                <td className="p-3 muted">{d.type === "PERCENT" ? "درصدی" : "مبلغ ثابت"}</td>
                <td className="p-3">{d.type === "PERCENT" ? `${fa(d.value)}٪` : `${fa(d.value)} تومان`}</td>
                <td className="p-3">{fa(d.usedCount)}{d.usageLimit ? ` / ${fa(d.usageLimit)}` : ""}</td>
                <td className="p-3">{d.isActive ? "فعال" : "غیرفعال"}</td>
                <td className="p-3 flex gap-3">
                  <Link href={`/admin/discounts/${d.id}/edit`} className="text-xs font-medium" style={{ color: "#404040" }}>ویرایش</Link>
                  <form action={async () => { "use server"; await deleteDiscount(d.id); }}>
                    <button className="text-xs" style={{ color: "#a24e56" }}>حذف</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {discounts.length === 0 && <p className="p-6 text-center muted text-sm">کد تخفیفی ثبت نشده است.</p>}
      </div>
    </div>
  );
}
