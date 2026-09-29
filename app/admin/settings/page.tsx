import { PageHead } from "@/components/admin/kit";
import { SettingsClient } from "@/components/admin/settings-client";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("settings.write", "/admin/settings");
  return (<><PageHead title="تنظیمات سایت" sub="بدون تغییر کد؛ تغییرات بلافاصله روی سایت اعمال می‌شود." /><SettingsClient /></>);
}
