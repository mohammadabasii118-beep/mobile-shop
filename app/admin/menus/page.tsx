import { db } from "@/lib/db";
import { PageHead } from "@/components/admin/kit";
import { ResourceManager } from "@/components/admin/resource-manager";
import { requireAdminPage } from "@/lib/server/admin/page";

const MENUS = [{ value: "main", label: "منوی اصلی (هدر)" }, { value: "footer", label: "فوتر" }, { value: "mobile", label: "موبایل" }];
export default async function Page() {
  await requireAdminPage("menu.write", "/admin/menus");
  const parents = await db.menuItem.findMany({ where: { parentId: null }, orderBy: [{ menu: "asc" }, { sortOrder: "asc" }], select: { id: true, label: true, menu: true } });
  return (
    <>
      <PageHead title="منوها" sub="هدر، فوتر و منوی کشویی موبایل از همین جدول خوانده می‌شود. برای منوی موبایل، آیتم‌های «موبایل» را (ورود، فروشگاه، وبلاگ، پشتیبانی و …) اضافه، حذف یا مرتب کنید؛ لینک «/account» برای کاربر واردشده «حساب کاربری» نشان داده می‌شود." />
      <ResourceManager resource="menus" noun="آیتم" sortable filters={[{ key: "menu", label: "منو", options: MENUS }]}
        columns={[{ key: "label", label: "عنوان" }, { key: "menu", label: "منو", map: Object.fromEntries(MENUS.map((m) => [m.value, m.label])) }, { key: "link", label: "لینک", kind: "code" }, { key: "parent.label", label: "والد" }, { key: "isActive", label: "وضعیت", kind: "bool" }]}
        defaults={{ menu: "main" }}
        fields={[
          { key: "label", label: "عنوان", type: "text", required: true }, { key: "menu", label: "منو", type: "select", options: MENUS },
          { key: "link", label: "لینک", type: "text", ltr: true, placeholder: "/shop" }, { key: "parentId", label: "والد", type: "select", nullable: true, options: parents.map((p) => ({ value: p.id, label: `${p.label} (${p.menu})` })) },
          { key: "isActive", label: "وضعیت", type: "bool" },
        ]} />
    </>
  );
}
