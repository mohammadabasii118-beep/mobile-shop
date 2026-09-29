import { PageHead } from "@/components/admin/kit";
import { OrdersClient } from "@/components/admin/orders-client";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; paymentStatus?: string }> }) {
  await requireAdminPage("order.read", "/admin/orders");
  const sp = await searchParams;
  return (<><PageHead title="سفارش‌ها" /><OrdersClient key={`${sp.status}${sp.paymentStatus}`} initial={sp} /></>);
}
