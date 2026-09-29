import { PageHead } from "@/components/admin/kit";
import { FinanceClient } from "@/components/admin/finance-client";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  const u = await requireAdminPage("wallet.read", "/admin/wallet");
  return (<><PageHead title="کیف پول مشتریان" sub="اعتبار واقعی مشتریان؛ هر تغییر با دلیل، موجودی قبل/بعد و شناسه مرجع ثبت و در لاگ عملیات ذخیره می‌شود." /><FinanceClient kind="wallet" canAdjust={u.permissions.includes("wallet.adjust")} /></>);
}
