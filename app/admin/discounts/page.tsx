import { PageHead } from "@/components/admin/kit";
import { DiscountsClient } from "@/components/admin/discounts-client";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("discount.write", "/admin/discounts");
  return (
    <>
      <PageHead title="تخفیف‌ها" sub="تخفیف خودکار روی قیمت هر کالا (محصول، دسته، تنوع، برند، مدل یا همه). کد تخفیف مشتری در بخش «کوپن‌ها» است." />
      <DiscountsClient />
    </>
  );
}
