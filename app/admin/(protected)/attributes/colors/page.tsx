import Link from "next/link";
import { db } from "@/lib/db";
import { deleteColor } from "@/lib/actions/attributes";

export default async function AdminColorsPage() {
  const colors = await db.color.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold">رنگ‌ها</h1>
        <Link href="/admin/attributes/colors/new" className="px-5 h-10 leading-[40px] rounded-full text-white text-sm font-bold" style={{ background: "var(--ink)" }}>+ رنگ جدید</Link>
      </div>
      <div className="surface border line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="surface2 text-xs muted">
            <tr>
              <th className="p-3 text-right">نمونه</th>
              <th className="p-3 text-right">نام</th>
              <th className="p-3 text-right">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {colors.map((c) => (
              <tr key={c.id} className="border-t line">
                <td className="p-3">
                  <span className="inline-block w-6 h-6 rounded-full border line" style={{ background: c.hexCode || "#ccc" }} />
                </td>
                <td className="p-3">{c.name}</td>
                <td className="p-3 flex gap-3">
                  <Link href={`/admin/attributes/colors/${c.id}/edit`} className="text-xs font-medium" style={{ color: "#404040" }}>ویرایش</Link>
                  <form action={async () => { "use server"; await deleteColor(c.id); }}>
                    <button className="text-xs" style={{ color: "#a24e56" }}>حذف</button>
                  </form>
                </td>
              </tr>
            ))}
            {colors.length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center muted text-sm">هنوز رنگی ثبت نشده است.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
