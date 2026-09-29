import { db } from "@/lib/db";
import { PageHead } from "@/components/admin/kit";
import { ResourceManager } from "@/components/admin/resource-manager";
import { requireAdminPage } from "@/lib/server/admin/page";

const TYPES = [{ value: "hero", label: "هدر اصلی" }, { value: "marquee", label: "نوار برندها" }, { value: "product_rail", label: "ردیف محصولات" }, { value: "categories", label: "دسته‌بندی‌ها" }, { value: "newest", label: "تازه‌ترین‌ها" }, { value: "banner", label: "بنر تلگرام" }, { value: "blog", label: "وبلاگ" }];
export default async function Page() {
  await requireAdminPage("homepage.write", "/admin/homepage");
  const cats = await db.category.findMany({ where: { parentId: null }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } });
  return (
    <>
      <PageHead title="بخش‌های صفحه اصلی" sub="ترتیب، فعال بودن، عنوان و محصولات هر بخش را بدون تغییر کد مدیریت کنید." />
      <ResourceManager resource="homepage" noun="بخش" sortable
        columns={[{ key: "title", label: "عنوان" }, { key: "key", label: "شناسه", kind: "code" }, { key: "type", label: "نوع", map: Object.fromEntries(TYPES.map((t) => [t.value, t.label])) }, { key: "isActive", label: "وضعیت", kind: "bool" }]}
        defaults={{ type: "product_rail" }}
        fields={[
          { key: "title", label: "عنوان", type: "text" }, { key: "subtitle", label: "زیرعنوان", type: "text" },
          { key: "key", label: "شناسه", type: "text", required: true, ltr: true, lockOnEdit: true }, { key: "type", label: "نوع بخش", type: "select", options: TYPES, lockOnEdit: true },
          { key: "link", label: "لینک «مشاهده همه»", type: "text", ltr: true }, { key: "isActive", label: "وضعیت", type: "bool" },
          { key: "config.categorySlug", label: "دسته‌بندی (برای ردیف محصولات)", type: "select", nullable: true, options: cats.map((c) => ({ value: c.slug, label: c.name })) },
          { key: "config.limit", label: "تعداد محصول", type: "number", nullable: true },
          { key: "config.placement", label: "محل بنر (برای بخش نوع «بنر»)", type: "text", ltr: true, hint: "کلید محل بنرها، مثلاً promo_summer؛ خالی = بنر تلگرام" },
          { key: "config.productIds", label: "محصولات دستی", type: "products" },
        ]} />
    </>
  );
}
