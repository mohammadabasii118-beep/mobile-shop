import { PageHead } from "@/components/admin/kit";
import { ResourceManager } from "@/components/admin/resource-manager";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("coupon.write", "/admin/coupons");
  return (
    <>
      <PageHead title="کوپن‌های تخفیف" sub="کوپن فقط روی اقلام با قیمت خرده اعمال می‌شود." />
      <ResourceManager resource="coupons" noun="کوپن" note="توجه: لغو سفارش هنوز شمارنده استفاده کوپن را برنمی‌گرداند (بدهی فنی ثبت‌شده در docs/TECH_DEBT.md)."
        columns={[{ key: "code", label: "کد", kind: "code" }, { key: "type", label: "نوع", map: { percent: "درصدی", fixed: "مبلغ ثابت" } }, { key: "value", label: "مقدار", kind: "num" }, { key: "minOrder", label: "حداقل سفارش", kind: "money" }, { key: "usedCount", label: "استفاده", kind: "num" }, { key: "usageLimit", label: "سقف کل", kind: "num" }, { key: "endsAt", label: "پایان", kind: "date" }, { key: "isActive", label: "وضعیت", kind: "bool" }]}
        defaults={{ type: "percent", isActive: true }}
        fields={[
          { key: "code", label: "کد", type: "text", required: true, ltr: true, lockOnEdit: true }, { key: "type", label: "نوع", type: "select", options: [{ value: "percent", label: "درصدی" }, { value: "fixed", label: "مبلغ ثابت (تومان)" }] },
          { key: "value", label: "مقدار (درصد یا تومان)", type: "number", required: true }, { key: "minOrder", label: "حداقل مبلغ سفارش", type: "number" },
          { key: "maxDiscount", label: "سقف تخفیف (تومان)", type: "number", nullable: true }, { key: "usageLimit", label: "سقف استفاده کل", type: "number", nullable: true },
          { key: "perUserLimit", label: "سقف برای هر کاربر", type: "number", nullable: true }, { key: "isActive", label: "وضعیت", type: "bool" },
          { key: "startsAt", label: "شروع", type: "date" }, { key: "endsAt", label: "پایان", type: "date" },
        ]} />
    </>
  );
}
