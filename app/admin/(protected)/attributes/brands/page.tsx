import Link from "next/link";
import { db } from "@/lib/db";
import { deleteBrand } from "@/lib/actions/attributes";

export default async function AdminBrandsPage() {
  const brands = await db.brand.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { models: true, variants: true } } } });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold">برندهای گوشی</h1>
        <Link href="/admin/attributes/brands/new" className="px-5 h-10 leading-[40px] rounded-full text-white text-sm font-bold" style={{ background: "var(--ink)" }}>+ برند جدید</Link>
      </div>
      <div className="surface border line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="surface2 text-xs muted">
            <tr>
              <th className="p-3 text-right">نام</th>
              <th className="p-3 text-right">تعداد مدل</th>
              <th className="p-3 text-right">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id} className="border-t line">
                <td className="p-3">{b.name}</td>
                <td className="p-3 muted">{b._count.models}</td>
                <td className="p-3 flex gap-3">
                  <Link href={`/admin/attributes/brands/${b.id}/edit`} className="text-xs font-medium" style={{ color: "#404040" }}>ویرایش</Link>
                  <form action={async () => { "use server"; await deleteBrand(b.id); }}>
                    <button className="text-xs" style={{ color: "#a24e56" }}>حذف</button>
                  </form>
                </td>
              </tr>
            ))}
            {brands.length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center muted text-sm">هنوز برندی ثبت نشده است.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
