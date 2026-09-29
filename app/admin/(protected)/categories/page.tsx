import Link from "next/link";
import { db } from "@/lib/db";
import { deleteCategory } from "@/lib/actions/categories";

export default async function AdminCategoriesPage() {
  const categories = await db.category.findMany({ include: { parent: true }, orderBy: [{ parentId: "asc" }, { order: "asc" }] });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold">دسته‌بندی‌ها</h1>
        <Link href="/admin/categories/new" className="px-5 h-10 leading-[40px] rounded-full text-white text-sm font-bold" style={{ background: "var(--ink)" }}>+ دسته‌بندی جدید</Link>
      </div>
      <div className="surface border line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="surface2 text-xs muted">
            <tr>
              <th className="p-3 text-right">نام</th>
              <th className="p-3 text-right">زیرمجموعه‌ی</th>
              <th className="p-3 text-right">ترتیب</th>
              <th className="p-3 text-right">وضعیت</th>
              <th className="p-3 text-right">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-t line">
                <td className="p-3">{c.name}</td>
                <td className="p-3 muted">{c.parent?.name || "—"}</td>
                <td className="p-3">{c.order}</td>
                <td className="p-3">{c.isActive ? "فعال" : "غیرفعال"}</td>
                <td className="p-3 flex gap-3">
                  <Link href={`/admin/categories/${c.id}/edit`} className="text-xs font-medium" style={{ color: "#404040" }}>ویرایش</Link>
                  <form action={async () => { "use server"; await deleteCategory(c.id); }}>
                    <button className="text-xs" style={{ color: "#a24e56" }}>حذف</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
