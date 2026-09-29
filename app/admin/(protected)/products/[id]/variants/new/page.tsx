import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import VariantForm from "@/components/admin/VariantForm";
import { createVariant } from "@/lib/actions/variants";

export default async function NewVariantPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const product = await db.product.findUnique({ where: { id: params.id } });
  if (!product) notFound();

  const [brands, models, colors] = await Promise.all([
    db.brand.findMany({ orderBy: { name: "asc" } }),
    db.phoneModel.findMany({ orderBy: { name: "asc" } }),
    db.color.findMany({ orderBy: { name: "asc" } }),
  ]);

  const action = createVariant.bind(null, product.id);

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">افزودن ترکیب برای «{product.name}»</h1>
      <VariantForm action={action} brands={brands} models={models} colors={colors} />
    </div>
  );
}
