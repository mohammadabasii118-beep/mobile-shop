import { PageHead } from "@/components/admin/kit";
import { CustomersClient } from "@/components/admin/customers-client";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("customer.read", "/admin/customers");
  return (<><PageHead title="مشتریان" sub="رمز عبور هرگز نمایش داده نمی‌شود." /><CustomersClient /></>);
}
