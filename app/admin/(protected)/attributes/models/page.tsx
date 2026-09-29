import Link from "next/link";
import { db } from "@/lib/db";
import { deletePhoneModel } from "@/lib/actions/attributes";

export default async function AdminModelsPage() {
  const models = await db.phoneModel.findMany({ orderBy: [{ brandId: "asc" }, { name: "asc" }], include: { brand: true } });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold">مدل‌های گوشی</h1>
        <Link href="/admin/attributes/models/new" className="px-5 h-10 leading-[40px] rounded-full text-white text-sm font-bold" style={{ background: "var(--ink)" }}>+ مدل جدید</Link>
      </div>
      <div className="surface border line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="surface2 text-xs muted">
            <tr>
              <th className="p-3 text-right">برند</th>
              <th className="p-3 text-right">مدل</th>
              <th className="p-3 text-right">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.id} className="border-t line">
                <td className="p-3 muted">{m.brand?.name || "—"}</td>
                <td className="p-3">{m.name}</td>
                <td className="p-3 flex gap-3">
                  <Link href={`/admin/attributes/models/${m.id}/edit`} className="text-xs font-medium" style={{ color: "#404040" }}>ویرایش</Link>
                  <form action={async () => { "use server"; await deletePhoneModel(m.id); }}>
                    <button className="text-xs" style={{ color: "#a24e56" }}>حذف</button>
                  </form>
                </td>
              </tr>
            ))}
            {models.length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center muted text-sm">هنوز مدلی ثبت نشده است.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
