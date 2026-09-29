export default function PricingRuleForm({
  action,
  rule,
}: {
  action: (formData: FormData) => Promise<void>;
  rule?: any;
}) {
  const f = (name: string, def: any = "") => (rule ? rule[name] ?? def : def);

  return (
    <form action={action} className="grid md:grid-cols-2 gap-4 max-w-lg">
      <div>
        <label className="text-sm font-medium block mb-1">از قیمت خرید (تومان)</label>
        <input name="minPrice" type="number" defaultValue={f("minPrice")} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">تا قیمت خرید (تومان)</label>
        <input name="maxPrice" type="number" defaultValue={f("maxPrice")} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div className="md:col-span-2">
        <label className="text-sm font-medium block mb-1">قیمت فروش (تومان)</label>
        <input name="sellPrice" type="number" defaultValue={f("sellPrice")} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={f("isActive", true)} /> فعال
      </div>
      <div className="md:col-span-2">
        <button className="px-8 h-11 rounded-full text-white font-bold text-sm" style={{ background: "var(--ink)" }}>ذخیره قانون</button>
      </div>
    </form>
  );
}
