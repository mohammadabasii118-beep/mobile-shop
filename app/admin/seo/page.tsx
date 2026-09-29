import { PageHead } from "@/components/admin/kit";
import { ResourceManager } from "@/components/admin/resource-manager";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("seo.write", "/admin/seo");
  return (
    <>
      <PageHead title="سئو" sub="تنظیمات پایه سئو برای هر بخش (مدیریت کامل سئو در فاز بعد)." />
      <ResourceManager resource="seo" noun="تنظیم"
        columns={[{ key: "scope", label: "بخش", kind: "code" }, { key: "title", label: "عنوان" }, { key: "robots", label: "Robots" }]}
        fields={[
          { key: "scope", label: "بخش (global, home, shop…)", type: "text", required: true, ltr: true, lockOnEdit: true }, { key: "title", label: "عنوان", type: "text" },
          { key: "description", label: "توضیحات", type: "textarea" }, { key: "ogImage", label: "تصویر اشتراک‌گذاری", type: "image" },
          { key: "robots", label: "Robots", type: "select", nullable: true, options: [{ value: "index,follow", label: "index, follow" }, { value: "noindex,follow", label: "noindex, follow" }, { value: "noindex,nofollow", label: "noindex, nofollow" }] },
        ]} />
    </>
  );
}
