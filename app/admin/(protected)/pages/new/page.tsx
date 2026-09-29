import PageForm from "@/components/admin/PageForm";
import { createPage } from "@/lib/actions/pages";

export default function NewPagePage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">افزودن صفحه محتوایی</h1>
      <PageForm action={createPage} />
    </div>
  );
}
