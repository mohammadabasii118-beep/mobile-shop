import { PageHead } from "@/components/admin/kit";
import { ReadonlyList } from "@/components/admin/readonly-list";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage(["support.read", "support.reply"], "/admin/support");
  return (<><PageHead title="پشتیبانی" sub="نمایش فقط‌خواندنی — مدیریت کامل در فاز بعد." /><ReadonlyList kind="support" /></>);
}
