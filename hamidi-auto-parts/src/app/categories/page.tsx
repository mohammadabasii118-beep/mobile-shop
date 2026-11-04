import type { Metadata } from "next";
import { PageHeader } from "@/components/shop/breadcrumbs";
import { CategoryCard } from "@/components/shop/category-card";
import { CATEGORIES } from "@/data/categories";
import { toFa } from "@/lib/utils";

export const metadata: Metadata = { title: "دسته‌بندی قطعات" };

export default function CategoriesPage() {
  return (
    <>
      <PageHeader title="دسته‌بندی قطعات" subtitle={`${toFa(CATEGORIES.length)} دسته تخصصی قطعات نیسان و هوندا؛ دسته مورد نظر را انتخاب کنید.`} crumbs={[{ label: "دسته‌بندی‌ها" }]} />
      <div className="container-x mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {CATEGORIES.map((c) => <CategoryCard key={c.id} c={c} large />)}
      </div>
    </>
  );
}
