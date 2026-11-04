import type { Metadata } from "next";
import { PageHeader } from "@/components/shop/breadcrumbs";
import { CategoryCard } from "@/components/shop/category-card";
import { CATEGORIES } from "@/data/categories";
import { categoryFacets } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
import { toFa } from "@/lib/utils";

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "دسته‌بندی لوازم یدکی نیسان و هوندا",
  description: "همه دسته‌بندی‌های قطعات خودرو: قطعات موتوری، سرسیلندر، پیستون و رینگ، خنک‌کننده، گیربکس، جلوبندی، عقب‌بندی، ترمز، برقی، سنسورها، بدنه و لوازم مصرفی نیسان و هوندا.",
  path: "/categories",
});

export default function CategoriesPage() {
  const counts = categoryFacets({});
  return (
    <>
      <PageHeader title="دسته‌بندی لوازم یدکی" subtitle={`${toFa(CATEGORIES.length)} دسته تخصصی قطعات نیسان و هوندا؛ دسته مورد نظر را انتخاب کنید.`} crumbs={[{ href: "/categories", label: "دسته‌بندی‌ها" }]} />
      <ul className="container-x mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {CATEGORIES.map((c) => <li key={c.id} className="flex [&>a]:w-full"><CategoryCard c={c} count={counts.get(c.id) ?? 0} large /></li>)}
      </ul>
    </>
  );
}
