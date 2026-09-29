import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import ColorForm from "@/components/admin/ColorForm";
import { updateColor } from "@/lib/actions/attributes";

export default async function EditColorPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const color = await db.color.findUnique({ where: { id: params.id } });
  if (!color) notFound();
  const action = updateColor.bind(null, color.id);
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">ویرایش رنگ</h1>
      <ColorForm action={action} color={color} />
    </div>
  );
}
