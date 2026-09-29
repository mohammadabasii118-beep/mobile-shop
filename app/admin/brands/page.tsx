import { PageHead } from "@/components/admin/kit";
import { ResourceManager } from "@/components/admin/resource-manager";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("brand.write", "/admin/brands");
  return (
    <>
      <PageHead title="برندها" sub="صفحه هر برند در سایت: /brand/اسلاگ" />
      <ResourceManager resource="brands" noun="برند" sortable
        columns={[{ key: "logo", label: "لوگو", kind: "image" }, { key: "name", label: "نام" }, { key: "slug", label: "اسلاگ", kind: "code" }, { key: "_count.products", label: "محصولات", kind: "num" }, { key: "isActive", label: "وضعیت", kind: "bool" }]}
        fields={[
          { key: "name", label: "نام", type: "text", required: true }, { key: "slug", label: "اسلاگ", type: "text", required: true, ltr: true },
          { key: "logo", label: "لوگو", type: "image" }, { key: "isActive", label: "وضعیت", type: "bool" }, { key: "description", label: "توضیحات", type: "textarea" },
          { key: "seoTitle", label: "عنوان سئو", type: "text" }, { key: "seoDescription", label: "توضیحات سئو", type: "textarea" },
        ]} />
    </>
  );
}
