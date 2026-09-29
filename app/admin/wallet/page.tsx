import { PageHead } from "@/components/admin/kit";
import { ReadonlyList } from "@/components/admin/readonly-list";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("wallet.read", "/admin/wallet");
  return (<><PageHead title="کیف پول" sub="نمایش فقط‌خواندنی — مدیریت کامل در فاز بعد." /><ReadonlyList kind="wallet" /></>);
}
