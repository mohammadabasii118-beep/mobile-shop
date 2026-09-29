import Link from "next/link";
import { db } from "@/lib/db";
import { deletePage } from "@/lib/actions/pages";

export default async function AdminPagesPage() {
  const pages = await db.page.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold">صفحات محتوایی</h1>
        <Link href="/admin/pages/new" className="px-5 h-10 leading-[40px] rounded-full text-white text-sm font-bold" style={{ background: "var(--ink)" }}>+ صفحه جدید</Link>
      </div>
      <p className="text-sm muted mb-6">صفحات ثابت مثل «درباره ما»، «حریم خصوصی»، «قوانین و مقررات» — هر کدام در آدرس <code>/page/&lt;اسلاگ&gt;</code> نمایش داده می‌شود.</p>
      <div className="surface border line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="surface2 text-xs muted">
            <tr>
              <th className="p-3 text-right">عنوان</th>
              <th className="p-3 text-right">آدرس</th>
              <th className="p-3 text-right">وضعیت</th>
              <th className="p-3 text-right">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id} className="border-t line">
                <td className="p-3">{p.title}</td>
                <td className="p-3 muted">/page/{p.slug}</td>
                <td className="p-3">{p.isPublished ? "منتشرشده" : "پیش‌نویس"}</td>
                <td className="p-3 flex gap-3">
                  <Link href={`/admin/pages/${p.id}/edit`} className="text-xs font-medium" style={{ color: "#404040" }}>ویرایش</Link>
                  <form action={async () => { "use server"; await deletePage(p.id); }}>
                    <button className="text-xs" style={{ color: "#a24e56" }}>حذف</button>
                  </form>
                </td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center muted text-sm">هنوز صفحه‌ای ساخته نشده است.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
