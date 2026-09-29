function toDateInput(d?: Date | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export default function DiscountForm({
  action,
  discount,
}: {
  action: (formData: FormData) => Promise<void>;
  discount?: any;
}) {
  const f = (name: string, def: any = "") => (discount ? discount[name] ?? def : def);

  return (
    <form action={action} className="grid md:grid-cols-2 gap-4 max-w-xl">
      <div>
        <label className="text-sm font-medium block mb-1">کد تخفیف</label>
        <input name="code" defaultValue={f("code")} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm font-mono" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">نوع تخفیف</label>
        <select name="type" defaultValue={f("type", "PERCENT")} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm">
          <option value="PERCENT">درصدی</option>
          <option value="FIXED">مبلغ ثابت (تومان)</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">مقدار</label>
        <input name="value" type="number" defaultValue={f("value")} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">حداقل مبلغ سفارش (اختیاری)</label>
        <input name="minOrderAmount" type="number" defaultValue={f("minOrderAmount", "")} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">تاریخ شروع (اختیاری)</label>
        <input name="startsAt" type="date" defaultValue={toDateInput(f("startsAt", null))} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">تاریخ پایان (اختیاری)</label>
        <input name="endsAt" type="date" defaultValue={toDateInput(f("endsAt", null))} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">محدودیت تعداد استفاده (اختیاری)</label>
        <input name="usageLimit" type="number" defaultValue={f("usageLimit", "")} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={f("isActive", true)} /> فعال
      </div>
      <div className="md:col-span-2">
        <button className="px-8 h-11 rounded-full text-white font-bold text-sm" style={{ background: "var(--ink)" }}>ذخیره کد تخفیف</button>
      </div>
    </form>
  );
}
