import { PageHead } from "@/components/admin/kit";
import { VariantsDemo } from "@/components/admin/variants-demo/demo-app";
import { requireAdminPage } from "@/lib/server/admin/page";

export const metadata = { title: "نمونه‌ی نمایشی سیستم Variant | مدیریت" };

export default async function Page() {
  await requireAdminPage("product.write", "/admin/variants-demo");
  return (<><PageHead title="نمونه‌ی نمایشی: سیستم Variant و Attribute" sub="Prototype بدون اتصال به دیتابیس — برای بررسی UX قبل از پیاده‌سازی نهایی." /><VariantsDemo /></>);
}
