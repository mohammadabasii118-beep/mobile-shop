import PricingRuleForm from "@/components/admin/PricingRuleForm";
import { createPricingRule } from "@/lib/actions/pricingRules";

export default function NewPricingRulePage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">افزودن قانون قیمت‌گذاری</h1>
      <PricingRuleForm action={createPricingRule} />
    </div>
  );
}
