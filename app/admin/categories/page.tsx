import { db } from "@/lib/db";
import { PageHead } from "@/components/admin/kit";
import { ResourceManager } from "@/components/admin/resource-manager";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("category.write", "/admin/categories");
  const tops = await db.category.findMany({ where: { parentId: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHead title="دسته‌بندی‌ها" sub="تغییرات بلافاصله در منو و فروشگاه دیده می‌شود." />
      <ResourceManager resource="categories" noun="دسته" sortable
        columns={[{ key: "name", label: "نام" }, { key: "slug", label: "اسلاگ", kind: "code" }, { key: "parent.name", label: "والد" }, { key: "_count.products", label: "محصولات", kind: "num" }, { key: "isActive", label: "وضعیت", kind: "bool" }]}
        fields={[
          { key: "name", label: "نام", type: "text", required: true }, { key: "slug", label: "اسلاگ (آدرس)", type: "text", required: true, ltr: true },
          { key: "parentId", label: "دسته والد", type: "select", nullable: true, options: tops.map((t) => ({ value: t.id, label: t.name })), hint: "خالی = دسته اصلی" },
          { key: "isActive", label: "وضعیت", type: "bool" }, { key: "image", label: "تصویر", type: "image" }, { key: "description", label: "توضیح", type: "textarea" },
          { key: "seoTitle", label: "عنوان سئو", type: "text", full: true }, { key: "seoDescription", label: "توضیحات سئو", type: "textarea" }, { key: "seoContent", label: "متن سئو", type: "textarea" },
        ]} />
    </>
  );
}
