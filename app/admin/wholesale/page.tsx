import { PageHead } from "@/components/admin/kit";
import { ResourceManager } from "@/components/admin/resource-manager";
import { WholesaleClient } from "@/components/admin/wholesale-client";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("wholesale.review", "/admin/wholesale");
  return (
    <>
      <PageHead title="همکاران عمده" sub="بررسی درخواست‌ها و مدیریت سطح‌ها (برنز، نقره‌ای، طلایی)" />
      <WholesaleClient canReview />
      <h2 className="mb-3 mt-8 text-lg font-black">سطح‌های همکاری</h2>
      <ResourceManager resource="tiers" noun="سطح" toggleKey="isActive"
        note="فقط سطح فعال برای همکاران اعمال می‌شود. «حداقل سفارش» در پرداخت نهایی بررسی می‌شود."
        columns={[{ key: "name", label: "نام" }, { key: "key", label: "شناسه", kind: "code" }, { key: "minOrder", label: "حداقل سفارش", kind: "money" }, { key: "discountPercent", label: "تخفیف اضافه ٪", kind: "num" }, { key: "_count.profiles", label: "همکاران", kind: "num" }, { key: "isActive", label: "وضعیت", kind: "bool" }]}
        defaults={{ priceRule: "wholesale_price", isActive: true }}
        fields={[
          { key: "name", label: "نام", type: "text", required: true }, { key: "key", label: "شناسه انگلیسی", type: "text", required: true, ltr: true, lockOnEdit: true },
          { key: "minOrder", label: "حداقل مبلغ سفارش (تومان)", type: "number" }, { key: "discountPercent", label: "درصد تخفیف اضافه", type: "number" },
          { key: "priceRule", label: "قانون قیمت", type: "select", options: [{ value: "wholesale_price", label: "قیمت عمده محصول" }, { value: "retail_minus_percent", label: "قیمت خرده منهای درصد" }] }, { key: "isActive", label: "وضعیت", type: "bool" },
        ]} />
    </>
  );
}
