import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import CategoryForm from "@/components/admin/CategoryForm";
import { updateCategory } from "@/lib/actions/categories";

export default async function EditCategoryPage({ params }: { params: { id: string } }) {
  const category = await db.category.findUnique({ where: { id: params.id } });
  if (!category) notFound();
  const action = updateCategory.bind(null, category.id);

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">ویرایش دسته‌بندی</h1>
      <CategoryForm action={action} category={category} />
    </div>
  );
}
