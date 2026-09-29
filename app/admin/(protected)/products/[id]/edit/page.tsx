import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import ProductForm from "@/components/admin/ProductForm";
import { updateProduct } from "@/lib/actions/products";

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const product = await db.product.findUnique({ where: { id: params.id } });
  if (!product) notFound();
  const action = updateProduct.bind(null, product.id);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-extrabold">ویرایش محصول</h1>
        <Link
          href={`/admin/products/${product.id}/variants`}
          className="px-5 h-10 leading-[40px] rounded-full border line text-sm font-bold"
        >
          مدیریت متغیرها ←
        </Link>
      </div>
      <ProductForm action={action} product={product} />
    </div>
  );
}
