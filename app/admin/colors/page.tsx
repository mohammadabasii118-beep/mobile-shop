import { PageHead } from "@/components/admin/kit";
import { ResourceManager } from "@/components/admin/resource-manager";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("product.write", "/admin/colors");
  return (
    <>
      <PageHead title="رنگ‌ها" sub="رنگ‌ها یک‌بار تعریف می‌شوند و در تنوع (Variant) محصولات انتخاب می‌شوند. رنگ استفاده‌شده را فقط می‌توان غیرفعال کرد." />
      <ResourceManager resource="colors" noun="رنگ" defaults={{ isActive: true }}
        columns={[{ key: "name", label: "رنگ" }, { key: "hex", label: "کد رنگ", kind: "code" }, { key: "_count.variants", label: "تعداد تنوع", kind: "num" }, { key: "isActive", label: "وضعیت", kind: "bool" }]}
        fields={[
          { key: "name", label: "نام رنگ (مثلاً سفید یخی)", type: "text", required: true },
          { key: "hex", label: "کد رنگ (اختیاری)", type: "text", ltr: true, placeholder: "#FFFFFF", nullable: true },
          { key: "isActive", label: "وضعیت", type: "bool" },
        ]} />
    </>
  );
}
