import { PageHead } from "@/components/admin/kit";
import { RefundsClient } from "@/components/admin/refunds-client";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  const u = await requireAdminPage(["refund.manage", "refund.approve"], "/admin/refunds");
  return (
    <>
      <PageHead title="بازگشت وجه" sub="بازگشت به کیف پول (با تأیید مشتری) و بازگشت بانکی دستی (با تأیید مدیر و شماره پیگیری) دو عملیات جدا هستند. وضعیت «مرجوع‌شده» فقط پس از بازگشت واقعی کل مبلغ ثبت می‌شود." />
      <RefundsClient canApprove={u.permissions.includes("refund.approve")} />
    </>
  );
}
