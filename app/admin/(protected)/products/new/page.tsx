import ProductForm from "@/components/admin/ProductForm";
import { createProduct } from "@/lib/actions/products";

export default function NewProductPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">افزودن محصول جدید</h1>
      <ProductForm action={createProduct} />
    </div>
  );
}
