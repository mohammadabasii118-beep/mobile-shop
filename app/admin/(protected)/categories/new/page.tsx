import CategoryForm from "@/components/admin/CategoryForm";
import { createCategory } from "@/lib/actions/categories";

export default function NewCategoryPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">افزودن دسته‌بندی</h1>
      <CategoryForm action={createCategory} />
    </div>
  );
}
