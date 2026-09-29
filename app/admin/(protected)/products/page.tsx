import Link from "next/link";
import { db } from "@/lib/db";
import { fmtToman } from "@/lib/format";
import { deleteProduct } from "@/lib/actions/products";

export default async function AdminProductsPage() {
  const products = await db.product.findMany({ include: { category: true }, orderBy: { createdAt: "desc" } });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold">محصولات</h1>
        <Link href="/admin/products/new" className="px-5 h-10 leading-[40px] rounded-full text-white text-sm font-bold" style={{ background: "var(--ink)" }}>+ محصول جدید</Link>
      </div>
      <div className="surface border line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="surface2 text-xs muted">
            <tr>
              <th className="p-3 text-right">نام</th>
              <th className="p-3 text-right">دسته‌بندی</th>
              <th className="p-3 text-right">قیمت</th>
              <th className="p-3 text-right">موجودی</th>
              <th className="p-3 text-right">وضعیت</th>
              <th className="p-3 text-right">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t line">
                <td className="p-3">{p.name}</td>
                <td className="p-3 muted">{p.category.name}</td>
                <td className="p-3">{fmtToman(p.price)}</td>
                <td className="p-3">{p.stock}</td>
                <td className="p-3">{p.isActive ? "فعال" : "غیرفعال"}</td>
                <td className="p-3 flex gap-3">
                  <Link href={`/admin/products/${p.id}/edit`} className="text-xs font-medium" style={{ color: "#404040" }}>ویرایش</Link>
                  <form action={async () => { "use server"; await deleteProduct(p.id); }}>
                    <button className="text-xs" style={{ color: "#a24e56" }}>حذف</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {products.length === 0 && <p className="p-6 text-center muted text-sm">هنوز محصولی ثبت نشده است.</p>}
      </div>
    </div>
  );
}
