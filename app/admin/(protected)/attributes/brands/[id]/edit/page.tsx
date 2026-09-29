import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import BrandForm from "@/components/admin/BrandForm";
import { updateBrand } from "@/lib/actions/attributes";

export default async function EditBrandPage({ params }: { params: { id: string } }) {
  const brand = await db.brand.findUnique({ where: { id: params.id } });
  if (!brand) notFound();
  const action = updateBrand.bind(null, brand.id);
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">ویرایش برند</h1>
      <BrandForm action={action} brand={brand} />
    </div>
  );
}
