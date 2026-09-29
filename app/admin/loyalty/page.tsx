import { PageHead } from "@/components/admin/kit";
import { FinanceClient } from "@/components/admin/finance-client";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  const u = await requireAdminPage("loyalty.read", "/admin/loyalty");
  return (<><PageHead title="باشگاه مشتریان" sub="امتیازها مستقل از کیف پول هستند؛ قوانین کسب و مصرف از بخش تنظیمات تعیین می‌شود." /><FinanceClient kind="loyalty" canAdjust={u.permissions.includes("loyalty.adjust")} /></>);
}
