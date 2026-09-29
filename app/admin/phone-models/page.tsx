import { db } from "@/lib/db";
import { PageHead } from "@/components/admin/kit";
import { ResourceManager } from "@/components/admin/resource-manager";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("phone.write", "/admin/phone-models");
  const brands = await db.brand.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  const opts = brands.map((b) => ({ value: b.id, label: b.name }));
  return (
    <>
      <PageHead title="مدل‌های گوشی" sub="صفحه هر مدل در سایت: /model/اسلاگ — محصولات سازگار خودکار متصل می‌شوند." />
      <ResourceManager resource="phone-models" noun="مدل" sortable={false}
        filters={[{ key: "brandId", label: "برند", options: opts }]}
        columns={[{ key: "name", label: "مدل" }, { key: "brand.name", label: "برند" }, { key: "slug", label: "اسلاگ", kind: "code" }, { key: "_count.products", label: "محصولات سازگار", kind: "num" }, { key: "isActive", label: "وضعیت", kind: "bool" }]}
        fields={[
          { key: "name", label: "نام مدل", type: "text", required: true }, { key: "slug", label: "اسلاگ", type: "text", required: true, ltr: true },
          { key: "brandId", label: "برند", type: "select", required: true, options: opts }, { key: "isActive", label: "وضعیت", type: "bool" },
          { key: "image", label: "تصویر", type: "image" }, { key: "description", label: "توضیحات", type: "textarea" },
          { key: "seoTitle", label: "عنوان سئو", type: "text" }, { key: "seoDescription", label: "توضیحات سئو", type: "textarea" },
        ]} />
    </>
  );
}
