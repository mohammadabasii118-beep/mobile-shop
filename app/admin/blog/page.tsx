import { db } from "@/lib/db";
import { PageHead } from "@/components/admin/kit";
import { ResourceManager } from "@/components/admin/resource-manager";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("blog.write", "/admin/blog");
  const cats = await db.blogCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const opts = cats.map((c) => ({ value: c.id, label: c.name }));
  return (
    <>
      <PageHead title="وبلاگ" sub="مقالات را با تصویر، دسته، برچسب، زمان انتشار (زمان‌بندی‌شده) و سئو مدیریت کنید. محتوا: خط خالی = پاراگراف جدید، «## » = عنوان، «- » = فهرست." />
      <ResourceManager resource="blog" noun="مقاله" toggleKey="isPublished" filters={[{ key: "categoryId", label: "دسته", options: opts }]}
        columns={[{ key: "featuredImage", label: "تصویر", kind: "image" }, { key: "title", label: "عنوان" }, { key: "category.name", label: "دسته" }, { key: "publishedAt", label: "زمان انتشار", kind: "date" }, { key: "isPublished", label: "منتشر شده", kind: "bool" }]}
        fields={[
          { key: "title", label: "عنوان", type: "text", required: true }, { key: "slug", label: "اسلاگ", type: "text", required: true, ltr: true },
          { key: "categoryId", label: "دسته", type: "select", nullable: true, options: opts }, { key: "authorName", label: "نویسنده", type: "text" },
          { key: "featuredImage", label: "تصویر شاخص", type: "image" }, { key: "excerpt", label: "خلاصه", type: "textarea" },
          { key: "content", label: "متن مقاله", type: "textarea", required: true }, { key: "tags", label: "برچسب‌ها (با ویرگول جدا کنید)", type: "tags", full: true },
          { key: "isPublished", label: "منتشر شود", type: "bool" }, { key: "publishedAt", label: "زمان انتشار (اگر آینده باشد، زمان‌بندی می‌شود)", type: "date" },
          { key: "seoTitle", label: "عنوان سئو", type: "text" }, { key: "canonical", label: "Canonical", type: "text", ltr: true }, { key: "seoDescription", label: "توضیحات سئو", type: "textarea" },
        ]} />
      <h2 className="mb-3 mt-8 text-lg font-black">دسته‌های وبلاگ</h2>
      <ResourceManager resource="blog-categories" noun="دسته" toggleKey="__none"
        columns={[{ key: "name", label: "نام" }, { key: "slug", label: "اسلاگ", kind: "code" }, { key: "_count.posts", label: "مقالات", kind: "num" }]}
        fields={[{ key: "name", label: "نام", type: "text", required: true }, { key: "slug", label: "اسلاگ", type: "text", required: true, ltr: true }]} />
    </>
  );
}
