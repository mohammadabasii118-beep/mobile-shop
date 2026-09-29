import { PageHead } from "@/components/admin/kit";
import { ResourceManager } from "@/components/admin/resource-manager";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("blog.write", "/admin/blog");
  return (
    <>
      <PageHead title="وبلاگ" sub="مدیریت ساده مقالات (ویرایشگر کامل در فاز بعد)." />
      <ResourceManager resource="blog" noun="مقاله" toggleKey="isPublished"
        columns={[{ key: "title", label: "عنوان" }, { key: "slug", label: "اسلاگ", kind: "code" }, { key: "publishedAt", label: "انتشار", kind: "date" }, { key: "isPublished", label: "منتشر شده", kind: "bool" }]}
        fields={[
          { key: "title", label: "عنوان", type: "text", required: true }, { key: "slug", label: "اسلاگ", type: "text", required: true, ltr: true },
          { key: "excerpt", label: "خلاصه", type: "textarea" }, { key: "content", label: "متن", type: "textarea", required: true },
          { key: "featuredImage", label: "تصویر شاخص", type: "image" }, { key: "authorName", label: "نویسنده", type: "text" },
          { key: "isPublished", label: "انتشار", type: "bool" }, { key: "seoTitle", label: "عنوان سئو", type: "text" }, { key: "seoDescription", label: "توضیحات سئو", type: "textarea" },
        ]} />
    </>
  );
}
