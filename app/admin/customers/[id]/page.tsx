import { PageHead } from "@/components/admin/kit";
import { CustomerDetail } from "@/components/admin/customer-detail";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireAdminPage("customer.read", `/admin/customers/${id}`);
  const has = (p: string) => u.permissions.includes(p);
  return (<><PageHead title="پروفایل مشتری" /><CustomerDetail id={id} selfId={u.id} canWrite={has("customer.write")} canRoles={has("role.manage")} canWholesale={has("wholesale.review")} /></>);
}
