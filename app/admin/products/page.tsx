import { db } from "@/lib/db";
import { PageHead } from "@/components/admin/kit";
import { ProductList } from "@/components/admin/product-list";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  const u = await requireAdminPage("product.read", "/admin/products");
  const [cats, brands] = await Promise.all([db.category.findMany({ orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }], select: { id: true, name: true } }), db.brand.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } })]);
  return (
    <>
      <PageHead title="محصولات" sub="قیمت خرده و عمده، تنوع، تصاویر و مدل‌های سازگار" />
      <ProductList canWrite={u.permissions.includes("product.write")} categories={cats.map((c) => ({ value: c.id, label: c.name }))} brands={brands.map((b) => ({ value: b.id, label: b.name }))} />
    </>
  );
}
