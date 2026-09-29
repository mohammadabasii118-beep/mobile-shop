import DiscountForm from "@/components/admin/DiscountForm";
import { createDiscount } from "@/lib/actions/discounts";

export default function NewDiscountPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">افزودن کد تخفیف</h1>
      <DiscountForm action={createDiscount} />
    </div>
  );
}
