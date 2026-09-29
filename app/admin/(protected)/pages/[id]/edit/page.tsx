import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import PageForm from "@/components/admin/PageForm";
import { updatePage } from "@/lib/actions/pages";

export default async function EditPagePage({ params }: { params: { id: string } }) {
  const page = await db.page.findUnique({ where: { id: params.id } });
  if (!page) notFound();
  const action = updatePage.bind(null, page.id);

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">ویرایش صفحه</h1>
      <PageForm action={action} page={page} />
    </div>
  );
}
