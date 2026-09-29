import PhoneModelForm from "@/components/admin/PhoneModelForm";
import { createPhoneModel } from "@/lib/actions/attributes";

export default function NewModelPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">افزودن مدل گوشی</h1>
      <PhoneModelForm action={createPhoneModel} />
    </div>
  );
}
