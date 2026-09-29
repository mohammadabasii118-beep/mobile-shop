import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import VariantForm from "@/components/admin/VariantForm";
import { updateVariant } from "@/lib/actions/variants";

export default async function EditVariantPage(props: { params: Promise<{ id: string; variantId: string }> }) {
  const params = await props.params;
  const [product, variant, brands, models, colors] = await Promise.all([
    db.product.findUnique({ where: { id: params.id } }),
    db.productVariant.findUnique({ where: { id: params.variantId } }),
    db.brand.findMany({ orderBy: { name: "asc" } }),
    db.phoneModel.findMany({ orderBy: { name: "asc" } }),
    db.color.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!product || !variant || variant.productId !== product.id) notFound();

  const action = updateVariant.bind(null, variant.id, product.id);

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">ویرایش ترکیب — «{product.name}»</h1>
      <VariantForm action={action} brands={brands} models={models} colors={colors} variant={variant} />
    </div>
  );
}
