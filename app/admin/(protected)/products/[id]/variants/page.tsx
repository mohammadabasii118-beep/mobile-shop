import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtToman, fa } from "@/lib/format";
import { deleteVariant } from "@/lib/actions/variants";

export default async function ProductVariantsPage({ params }: { params: { id: string } }) {
  const product = await db.product.findUnique({ where: { id: params.id } });
  if (!product) notFound();

  const variants = await db.productVariant.findMany({
    where: { productId: product.id },
    include: { brand: true, phoneModel: true, color: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-extrabold">متغیرهای «{product.name}»</h1>
        <Link href={`/admin/products/${product.id}/variants/new`} className="px-5 h-10 leading-[40px] rounded-full text-white text-sm font-bold" style={{ background: "var(--ink)" }}>+ ترکیب جدید</Link>
      </div>
      <p className="muted text-sm mb-6">
        برای هر ترکیب برند/مدل/رنگ، قیمت، موجودی، تصویر و کد محصول جداگانه تعریف می‌شود.
        <Link href={`/admin/products/${product.id}/edit`} className="underline underline-offset-4 mr-1">بازگشت به ویرایش محصول</Link>
      </p>

      <div className="surface border line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="surface2 text-xs muted">
            <tr>
              <th className="p-3 text-right">ترکیب</th>
              <th className="p-3 text-right">SKU</th>
              <th className="p-3 text-right">قیمت</th>
              <th className="p-3 text-right">موجودی</th>
              <th className="p-3 text-right">وضعیت</th>
              <th className="p-3 text-right">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const label = [v.brand?.name, v.phoneModel?.name, v.color?.name].filter(Boolean).join(" / ") || "—";
              return (
                <tr key={v.id} className="border-t line">
                  <td className="p-3">{label}</td>
                  <td className="p-3 muted">{v.sku || "—"}</td>
                  <td className="p-3">{fmtToman(v.price)}</td>
                  <td className="p-3">{fa(v.stock)}</td>
                  <td className="p-3">{v.isActive ? "فعال" : "غیرفعال"}</td>
                  <td className="p-3 flex gap-3">
                    <Link href={`/admin/products/${product.id}/variants/${v.id}/edit`} className="text-xs font-medium" style={{ color: "#404040" }}>ویرایش</Link>
                    <form action={async () => { "use server"; await deleteVariant(v.id, product.id); }}>
                      <button className="text-xs" style={{ color: "#a24e56" }}>حذف</button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {variants.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center muted text-sm">هنوز ترکیبی ثبت نشده است.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
