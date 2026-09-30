import Link from "next/link";
import { db } from "@/lib/db";
import { Card, PageHead } from "@/components/admin/kit";
import { ResourceManager } from "@/components/admin/resource-manager";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("product.write", "/admin/attributes");
  const custom = await db.attribute.findMany({ where: { isSystem: false }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  const opts = custom.map((a) => ({ value: a.id, label: a.name }));
  return (
    <>
      <PageHead title="Attributeها" sub="تعریف مرکزی ویژگی‌ها و مقدارهایشان. «مدل گوشی» و «رنگ» Attribute سیستمی‌اند و در ماتریس Variant شرکت می‌کنند؛ بقیه (جنس، طرح، سایز…) در فرم محصول انتخاب و در مشخصات نمایش داده می‌شوند." />
      <Card className="mb-4 flex flex-wrap items-center gap-3 text-xs leading-7">
        <b>Attributeهای سیستمی:</b>
        <Link href="/admin/phone-models" className="rounded-full bg-primary/12 px-3 py-1 font-bold text-primary">مدل گوشی ← مدیریت برند/سری/مدل</Link>
        <Link href="/admin/colors" className="rounded-full bg-primary/12 px-3 py-1 font-bold text-primary">رنگ ← مدیریت رنگ‌ها</Link>
      </Card>
      <div className="space-y-6">
        <ResourceManager resource="attributes" noun="Attribute" defaults={{ isActive: true }} sortable={false}
          columns={[{ key: "name", label: "Attribute" }, { key: "slug", label: "اسلاگ", kind: "code" }, { key: "_count.values", label: "مقادیر", kind: "num" }, { key: "isSystem", label: "سیستمی", kind: "bool" }, { key: "isActive", label: "وضعیت", kind: "bool" }]}
          fields={[{ key: "name", label: "نام (مثلاً جنس)", type: "text", required: true }, { key: "slug", label: "اسلاگ", type: "text", required: true, ltr: true }, { key: "isActive", label: "وضعیت", type: "bool" }]} />
        <ResourceManager resource="attribute-values" noun="مقدار" defaults={{ isActive: true }} sortable={false}
          filters={[{ key: "attributeId", label: "Attribute", options: opts }]}
          columns={[{ key: "value", label: "مقدار" }, { key: "attribute.name", label: "Attribute" }, { key: "hex", label: "کد رنگ", kind: "code" }, { key: "_count.products", label: "محصولات", kind: "num" }, { key: "isActive", label: "وضعیت", kind: "bool" }]}
          fields={[
            { key: "attributeId", label: "Attribute", type: "select", required: true, options: opts, lockOnEdit: true }, { key: "value", label: "مقدار (مثلاً سیلیکون)", type: "text", required: true },
            { key: "hex", label: "کد رنگ (اختیاری)", type: "text", ltr: true, nullable: true }, { key: "isActive", label: "وضعیت", type: "bool" },
          ]} />
      </div>
    </>
  );
}
