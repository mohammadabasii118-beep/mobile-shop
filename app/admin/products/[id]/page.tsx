import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHead } from "@/components/admin/kit";
import { ProductForm, type ProductData } from "@/components/admin/product-form";
import { getProduct } from "@/lib/server/admin/products";
import { emptyProduct, toFormData } from "@/lib/admin/product-map";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireAdminPage("product.read", `/admin/products/${id}`);
  const [cats, brands, models, colors] = await Promise.all([
    db.category.findMany({ orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }], select: { id: true, name: true, parent: { select: { name: true } } } }),
    db.brand.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.phoneModel.findMany({ orderBy: [{ brand: { sortOrder: "asc" } }, { sortOrder: "asc" }], select: { id: true, name: true, brand: { select: { name: true } } } }),
    db.color.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const canCost = u.permissions.includes("pricing.read") || u.permissions.includes("pricing.write");
  const categories = cats.map((c) => ({ value: c.id, label: c.parent ? `${c.parent.name} › ${c.name}` : c.name }));
  let initial: ProductData;
  if (id === "new") {
    if (!u.permissions.includes("product.write")) notFound();
    initial = emptyProduct(categories[0]?.value ?? "");
  } else {
    const p = await getProduct(id, { cost: canCost }).catch(() => null);
    if (!p) notFound();
    initial = toFormData(p);
  }
  return (
    <>
      <PageHead title={id === "new" ? "محصول جدید" : initial.name} />
      <ProductForm key={id} initial={initial} categories={categories} brands={brands.map((b) => ({ value: b.id, label: b.name }))} phoneModels={models.map((m) => ({ value: m.id, label: m.name, group: m.brand.name }))} colors={colors.map((c) => ({ value: c.id, label: c.name }))}
        canWrite={u.permissions.includes("product.write")} canDelete={u.permissions.includes("product.delete")} canStock={u.permissions.includes("inventory.write")} canPrice={u.permissions.includes("pricing.write")} canCost={canCost} />
    </>
  );
}
