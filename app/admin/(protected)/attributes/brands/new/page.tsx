import BrandForm from "@/components/admin/BrandForm";
import { createBrand } from "@/lib/actions/attributes";

export default function NewBrandPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">افزودن برند</h1>
      <BrandForm action={createBrand} />
    </div>
  );
}
