import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import PhoneModelForm from "@/components/admin/PhoneModelForm";
import { updatePhoneModel } from "@/lib/actions/attributes";

export default async function EditModelPage({ params }: { params: { id: string } }) {
  const model = await db.phoneModel.findUnique({ where: { id: params.id } });
  if (!model) notFound();
  const action = updatePhoneModel.bind(null, model.id);
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">ویرایش مدل گوشی</h1>
      <PhoneModelForm action={action} model={model} />
    </div>
  );
}
