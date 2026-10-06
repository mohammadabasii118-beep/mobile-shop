import { PageHead } from "@/components/admin/kit";
import { ResourceManager } from "@/components/admin/resource-manager";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("shipping.write", "/admin/shipping");
  return (
    <>
      <PageHead title="روش‌های ارسال" sub="هزینه و شرایط ارسال رایگان در صفحه پرداخت واقعی اعمال می‌شود." />
      <ResourceManager resource="shipping" noun="روش ارسال" sortable
        columns={[{ key: "name", label: "نام" }, { key: "key", label: "شناسه", kind: "code" }, { key: "cost", label: "هزینه", kind: "money" }, { key: "freeThreshold", label: "ارسال رایگان از", kind: "money" }, { key: "isActive", label: "وضعیت", kind: "bool" }]}
        fields={[
          { key: "name", label: "نام", type: "text", required: true }, { key: "key", label: "شناسه انگلیسی", type: "text", required: true, ltr: true, lockOnEdit: true },
          { key: "cost", label: "هزینه (تومان)", type: "number", required: true }, { key: "freeThreshold", label: "ارسال رایگان برای سفارش بالای (تومان)", type: "number", nullable: true },
          { key: "isActive", label: "وضعیت", type: "bool" }, { key: "description", label: "توضیحات", type: "textarea" },
        ]} />
    </>
  );
}
