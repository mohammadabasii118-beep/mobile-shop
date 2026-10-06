import { db } from "@/lib/db";
import { PageHead } from "@/components/admin/kit";
import { ResourceManager } from "@/components/admin/resource-manager";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("phone.write", "/admin/phone-series");
  const brands = await db.brand.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  const opts = brands.map((b) => ({ value: b.id, label: b.name }));
  return (
    <>
      <PageHead title="سری‌های گوشی" sub="برند ← سری ← مدل؛ مثلاً Apple ← iPhone 13 ← iPhone 13 Pro. سری فقط برای گروه‌بندی و جستجو است و مدل‌ها را در «مدل‌های گوشی» به آن وصل می‌کنید." />
      <ResourceManager resource="phone-series" noun="سری" defaults={{ isActive: true }} sortable={false}
        filters={[{ key: "brandId", label: "برند", options: opts }]}
        columns={[{ key: "name", label: "سری" }, { key: "brand.name", label: "برند" }, { key: "slug", label: "اسلاگ", kind: "code" }, { key: "_count.models", label: "مدل‌ها", kind: "num" }, { key: "isActive", label: "وضعیت", kind: "bool" }]}
        fields={[
          { key: "name", label: "نام سری", type: "text", required: true }, { key: "slug", label: "اسلاگ", type: "text", required: true, ltr: true },
          { key: "brandId", label: "برند", type: "select", required: true, options: opts, lockOnEdit: true }, { key: "isActive", label: "وضعیت", type: "bool" },
        ]} />
    </>
  );
}
