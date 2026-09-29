import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import PricingRuleForm from "@/components/admin/PricingRuleForm";
import { updatePricingRule } from "@/lib/actions/pricingRules";

export default async function EditPricingRulePage({ params }: { params: { id: string } }) {
  const rule = await db.pricingRule.findUnique({ where: { id: params.id } });
  if (!rule) notFound();
  const action = updatePricingRule.bind(null, rule.id);

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">ویرایش قانون قیمت‌گذاری</h1>
      <PricingRuleForm action={action} rule={rule} />
    </div>
  );
}
