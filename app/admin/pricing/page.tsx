import { db } from "@/lib/db";
import { PageHead } from "@/components/admin/kit";
import { PricingClient } from "@/components/admin/pricing-client";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const u = await requireAdminPage(["pricing.read", "pricing.write"], "/admin/pricing");
  const { tab } = await searchParams;
  const [cats, brands, models, colors] = await Promise.all([
    db.category.findMany({ orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }], select: { id: true, name: true, parent: { select: { name: true } } } }),
    db.brand.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.phoneModel.findMany({ orderBy: [{ brand: { sortOrder: "asc" } }, { sortOrder: "asc" }], select: { id: true, name: true, brand: { select: { name: true } } } }),
    db.color.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHead title="قیمت‌گذاری" sub="هزینه خرید، سود، قیمت محاسبه‌شده، تخفیف و قیمت نهایی هر تنوع. همهٔ محاسبه‌ها سمت سرور انجام می‌شود." />
      <PricingClient categories={cats.map((c) => ({ value: c.id, label: c.parent ? `${c.parent.name} › ${c.name}` : c.name }))} phoneBrands={brands.map((b) => ({ value: b.id, label: b.name }))} productBrands={brands.map((b) => ({ value: b.id, label: b.name }))}
        models={models.map((m) => ({ value: m.id, label: m.name, group: m.brand.name }))} colors={colors.map((c) => ({ value: c.id, label: c.name }))} canWrite={u.permissions.includes("pricing.write")} initialTab={tab ?? "prices"} />
    </>
  );
}
