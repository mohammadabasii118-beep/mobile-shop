import { db } from "@/lib/db";
import { createWholesaleTier, deleteWholesaleTier } from "@/lib/actions/wholesaleTiers";

export const metadata = { title: "پله‌های تخفیف عمده | پنل مدیریت" };

export default async function AdminWholesaleTiersPage() {
  const tiers = await db.wholesaleTier.findMany({ orderBy: { minQuantity: "asc" } });

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">پله‌های تخفیف حجمی همکاران</h1>
      <p className="text-sm muted mb-6 max-w-2xl">
        این تخفیف فقط برای حساب‌های همکار تأییدشده (عمده‌فروش) اعمال می‌شود و روی قیمت عمده (یا قیمت عادی، اگر قیمت عمده تعریف نشده) هر خط سفارش، بر اساس تعداد همان خط، اضافه می‌شود. محاسبه‌ی نهایی همیشه در لحظه‌ی ثبت سفارش و سمت سرور انجام می‌شود.
      </p>

      <form action={createWholesaleTier} className="grid sm:grid-cols-3 gap-3 mb-8 surface border line rounded-2xl p-5 max-w-xl">
        <input name="minQuantity" type="number" min={2} required placeholder="حداقل تعداد (مثلاً ۱۰)" className="h-11 rounded-lg border line bg-transparent px-3 text-sm" />
        <input name="discountPercent" type="number" min={1} max={90} required placeholder="درصد تخفیف اضافه" className="h-11 rounded-lg border line bg-transparent px-3 text-sm" />
        <button className="h-11 rounded-full text-white text-sm font-bold" style={{ background: "var(--ink)" }}>افزودن پله</button>
        <label className="flex items-center gap-2 text-xs col-span-3">
          <input type="checkbox" name="isActive" defaultChecked /> فعال
        </label>
      </form>

      <div className="surface border line rounded-2xl overflow-hidden max-w-xl">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="surface2 text-xs muted">
            <tr>
              <th className="p-3 text-right">حداقل تعداد</th>
              <th className="p-3 text-right">درصد تخفیف اضافه</th>
              <th className="p-3 text-right">وضعیت</th>
              <th className="p-3 text-right">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t.id} className="border-t line">
                <td className="p-3">{t.minQuantity} عدد به بالا</td>
                <td className="p-3">{t.discountPercent}٪</td>
                <td className="p-3">{t.isActive ? "فعال" : "غیرفعال"}</td>
                <td className="p-3">
                  <form action={async () => { "use server"; await deleteWholesaleTier(t.id); }}>
                    <button className="text-xs" style={{ color: "#a24e56" }}>حذف</button>
                  </form>
                </td>
              </tr>
            ))}
            {tiers.length === 0 && <tr><td colSpan={4} className="p-6 text-center muted text-sm">هنوز پله‌ای تعریف نشده است.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
