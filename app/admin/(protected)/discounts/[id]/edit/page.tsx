import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import DiscountForm from "@/components/admin/DiscountForm";
import { updateDiscount } from "@/lib/actions/discounts";

export default async function EditDiscountPage({ params }: { params: { id: string } }) {
  const discount = await db.discount.findUnique({ where: { id: params.id } });
  if (!discount) notFound();
  const action = updateDiscount.bind(null, discount.id);

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">ویرایش کد تخفیف</h1>
      <DiscountForm action={action} discount={discount} />
    </div>
  );
}
