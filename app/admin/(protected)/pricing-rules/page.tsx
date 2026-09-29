import Link from "next/link";
import { db } from "@/lib/db";
import { fmtToman } from "@/lib/format";
import { deletePricingRule } from "@/lib/actions/pricingRules";

export default async function AdminPricingRulesPage() {
  const rules = await db.pricingRule.findMany({ orderBy: { minPrice: "asc" } });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-extrabold">قوانین قیمت‌گذاری</h1>
        <Link href="/admin/pricing-rules/new" className="px-5 h-10 leading-[40px] rounded-full text-white text-sm font-bold" style={{ background: "var(--ink)" }}>+ قانون جدید</Link>
      </div>
      <p className="text-sm muted mb-6">هنگام دریافت محصول از تأمین‌کننده، بر اساس قیمت خرید (Cost Price) در یکی از این بازه‌ها، قیمت فروش به‌صورت خودکار تعیین می‌شود.</p>
      <div className="surface border line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="surface2 text-xs muted">
            <tr>
              <th className="p-3 text-right">از قیمت خرید</th>
              <th className="p-3 text-right">تا قیمت خرید</th>
              <th className="p-3 text-right">قیمت فروش</th>
              <th className="p-3 text-right">وضعیت</th>
              <th className="p-3 text-right">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t line">
                <td className="p-3">{fmtToman(r.minPrice)}</td>
                <td className="p-3">{fmtToman(r.maxPrice)}</td>
                <td className="p-3 font-bold">{fmtToman(r.sellPrice)}</td>
                <td className="p-3">{r.isActive ? "فعال" : "غیرفعال"}</td>
                <td className="p-3 flex gap-3">
                  <Link href={`/admin/pricing-rules/${r.id}/edit`} className="text-xs font-medium" style={{ color: "#404040" }}>ویرایش</Link>
                  <form action={async () => { "use server"; await deletePricingRule(r.id); }}>
                    <button className="text-xs" style={{ color: "#a24e56" }}>حذف</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {rules.length === 0 && <p className="p-6 text-center muted text-sm">قانونی ثبت نشده است.</p>}
      </div>
    </div>
  );
}
