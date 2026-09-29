import { PageHead } from "@/components/admin/kit";
import { ResourceManager } from "@/components/admin/resource-manager";
import { requireAdminPage } from "@/lib/server/admin/page";

const PLACEMENTS = [{ value: "home_telegram", label: "صفحه اصلی — بنر تلگرام" }, { value: "shop_top", label: "بالای صفحه فروشگاه" }];
export default async function Page() {
  await requireAdminPage("banner.write", "/admin/banners");
  return (
    <>
      <PageHead title="بنرها" sub="فقط بنرِ فعال و در بازه زمانی مجاز، با کمترین ترتیب نمایش داده می‌شود." />
      <ResourceManager resource="banners" noun="بنر" sortable filters={[{ key: "placement", label: "محل", options: PLACEMENTS }]}
        columns={[{ key: "desktopImage", label: "تصویر", kind: "image" }, { key: "title", label: "عنوان" }, { key: "placement", label: "محل", map: Object.fromEntries(PLACEMENTS.map((p) => [p.value, p.label])) }, { key: "startsAt", label: "شروع", kind: "date" }, { key: "endsAt", label: "پایان", kind: "date" }, { key: "isActive", label: "وضعیت", kind: "bool" }]}
        defaults={{ placement: "home_telegram" }}
        fields={[
          { key: "title", label: "عنوان", type: "text", required: true }, { key: "subtitle", label: "زیرعنوان", type: "text" },
          { key: "placement", label: "محل نمایش", type: "select", options: PLACEMENTS }, { key: "isActive", label: "وضعیت", type: "bool" },
          { key: "description", label: "توضیحات", type: "textarea" }, { key: "desktopImage", label: "تصویر دسکتاپ", type: "image" }, { key: "mobileImage", label: "تصویر موبایل", type: "image" },
          { key: "buttonText", label: "متن دکمه", type: "text" }, { key: "buttonLink", label: "لینک دکمه", type: "text", ltr: true },
          { key: "startsAt", label: "شروع نمایش", type: "date" }, { key: "endsAt", label: "پایان نمایش", type: "date" },
        ]} />
    </>
  );
}
