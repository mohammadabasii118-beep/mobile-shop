import { PageHead } from "@/components/admin/kit";
import { InventoryClient } from "@/components/admin/inventory-client";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; low?: string }> }) {
  const u = await requireAdminPage("inventory.write", "/admin/inventory");
  const sp = await searchParams;
  return (
    <>
      <PageHead title="موجودی انبار" sub="هر تغییر موجودی همراه با دلیل در تاریخچه و لاگ عملیات ثبت می‌شود." />
      <InventoryClient key={(sp.q ?? "") + sp.low} initialQ={sp.q ?? ""} initialLow={sp.low === "1"} canWrite={u.permissions.includes("inventory.write")} />
    </>
  );
}
