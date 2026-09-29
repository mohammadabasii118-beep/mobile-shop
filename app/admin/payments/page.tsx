import { PageHead } from "@/components/admin/kit";
import { PaymentsClient } from "@/components/admin/payments-client";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("payment.review", "/admin/payments");
  return (<><PageHead title="بررسی پرداخت‌ها" sub="رسیدها فقط برای کارکنان دارای مجوز قابل مشاهده است." /><PaymentsClient /></>);
}
