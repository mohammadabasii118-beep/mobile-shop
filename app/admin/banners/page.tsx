import { PageHead } from "@/components/admin/kit";
import { ResourceManager } from "@/components/admin/resource-manager";
import { requireAdminPage } from "@/lib/server/admin/page";

const PLACEMENTS = [{ value: "home_telegram", label: "صفحه اصلی — بنر تلگرام" }, { value: "shop_top", label: "بالای صفحه فروشگاه" }, { value: "product_top", label: "بالای صفحه محصول" }, { value: "blog_top", label: "بالای صفحه وبلاگ" }];
export default async function Page() {
  await requireAdminPage("banner.write", "/admin/banners");
  return (
    <>
      <PageHead title="بنرها" sub="همه بنرهای فعال و در بازه زمانی مجاز هر محل، به ترتیب نمایش داده می‌شوند." />
      <ResourceManager resource="banners" noun="بنر" sortable 
        columns={[{ key: "desktopImage", label: "تصویر", kind: "image" }, { key: "title", label: "عنوان" }, { key: "placement", label: "محل (کلید)", kind: "code" }, { key: "startsAt", label: "شروع", kind: "date" }, { key: "endsAt", label: "پایان", kind: "date" }, { key: "isActive", label: "وضعیت", kind: "bool" }]}
        defaults={{ placement: "home_telegram" }}
        fields={[
          { key: "title", label: "عنوان", type: "text", required: true }, { key: "subtitle", label: "زیرعنوان", type: "text" },
          { key: "placement", label: "محل نمایش (کلید)", type: "combo", options: PLACEMENTS, hint: "یکی از محل‌های آماده یا کلید دلخواه (مثلاً promo_summer) که در «صفحه اصلی» به یک بخش بنر وصل می‌شود." }, { key: "isActive", label: "وضعیت", type: "bool" },
          { key: "description", label: "توضیحات", type: "textarea" }, { key: "desktopImage", label: "تصویر دسکتاپ", type: "image" }, { key: "mobileImage", label: "تصویر موبایل", type: "image" },
          { key: "buttonText", label: "متن دکمه", type: "text" }, { key: "buttonLink", label: "لینک دکمه", type: "text", ltr: true },
          { key: "startsAt", label: "شروع نمایش", type: "date" }, { key: "endsAt", label: "پایان نمایش", type: "date" },
        ]} />
    </>
  );
}
