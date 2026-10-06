import { db } from "@/lib/db";
import { PageHead } from "@/components/admin/kit";
import { ResourceManager } from "@/components/admin/resource-manager";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("phone.write", "/admin/phone-models");
  const brands = await db.brand.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  const opts = brands.map((b) => ({ value: b.id, label: b.name }));
  const series = await db.phoneSeries.findMany({ orderBy: [{ brand: { sortOrder: "asc" } }, { sortOrder: "asc" }], select: { id: true, name: true, brand: { select: { name: true } } } });
  const seriesOpts = series.map((x) => ({ value: x.id, label: `${x.brand.name} › ${x.name}` }));
  return (
    <>
      <PageHead title="مدل‌های گوشی" sub="ساختار: برند ← سری ← مدل. سری‌ها را در «سری‌های گوشی» تعریف و مدل‌ها را اینجا به سری وصل کنید (مدل‌های بدون سری مجاز است). صفحه هر مدل: /model/اسلاگ" />
      <ResourceManager resource="phone-models" noun="مدل" sortable={false}
        filters={[{ key: "brandId", label: "برند", options: opts }, { key: "seriesId", label: "سری", options: seriesOpts }]}
        columns={[{ key: "name", label: "مدل" }, { key: "brand.name", label: "برند" }, { key: "series.name", label: "سری" }, { key: "slug", label: "اسلاگ", kind: "code" }, { key: "_count.products", label: "محصولات سازگار", kind: "num" }, { key: "isActive", label: "وضعیت", kind: "bool" }]}
        fields={[
          { key: "name", label: "نام مدل", type: "text", required: true }, { key: "slug", label: "اسلاگ", type: "text", required: true, ltr: true },
          { key: "brandId", label: "برند", type: "select", required: true, options: opts }, { key: "seriesId", label: "سری (اختیاری؛ باید متعلق به همین برند باشد)", type: "select", nullable: true, options: seriesOpts }, { key: "isActive", label: "وضعیت", type: "bool" },
          { key: "image", label: "تصویر", type: "image" }, { key: "description", label: "توضیحات", type: "textarea" },
          { key: "seoTitle", label: "عنوان سئو", type: "text" }, { key: "seoDescription", label: "توضیحات سئو", type: "textarea" },
        ]} />
    </>
  );
}
