import { PageHead } from "@/components/admin/kit";
import { CustomersClient } from "@/components/admin/customers-client";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  const u = await requireAdminPage("customer.read", "/admin/customers");
  return (<><PageHead title="مشتریان" sub="رمز عبور هرگز نمایش داده نمی‌شود. کاربر یا مدیر جدید را می‌توانید دستی بسازید." /><CustomersClient canCreate={u.permissions.includes("customer.write")} canCreateAdmin={u.permissions.includes("role.manage")} /></>);
}
