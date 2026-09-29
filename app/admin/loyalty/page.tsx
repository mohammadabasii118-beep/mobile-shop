import { PageHead } from "@/components/admin/kit";
import { ReadonlyList } from "@/components/admin/readonly-list";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("loyalty.read", "/admin/loyalty");
  return (<><PageHead title="باشگاه مشتریان" sub="نمایش فقط‌خواندنی — مدیریت کامل در فاز بعد." /><ReadonlyList kind="loyalty" /></>);
}
