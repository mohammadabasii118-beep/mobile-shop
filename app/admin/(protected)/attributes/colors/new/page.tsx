import ColorForm from "@/components/admin/ColorForm";
import { createColor } from "@/lib/actions/attributes";

export default function NewColorPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">افزودن رنگ</h1>
      <ColorForm action={createColor} />
    </div>
  );
}
