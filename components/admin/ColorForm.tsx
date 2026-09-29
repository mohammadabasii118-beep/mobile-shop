export default function ColorForm({
  action,
  color,
}: {
  action: (formData: FormData) => Promise<void>;
  color?: any;
}) {
  const f = (name: string, def: any = "") => (color ? color[name] ?? def : def);
  return (
    <form action={action} className="grid md:grid-cols-2 gap-4 max-w-xl">
      <div>
        <label className="text-sm font-medium block mb-1">نام رنگ</label>
        <input name="name" defaultValue={f("name")} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">اسلاگ (URL انگلیسی)</label>
        <input name="slug" defaultValue={f("slug")} required pattern="[a-z0-9-]+" className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">کد رنگ (اختیاری)</label>
        <input name="hexCode" type="color" defaultValue={f("hexCode", "#000000")} className="w-full h-11 rounded-lg border line bg-transparent px-3" />
      </div>
      <div className="md:col-span-2">
        <button className="px-8 h-11 rounded-full text-white font-bold text-sm" style={{ background: "var(--ink)" }}>ذخیره رنگ</button>
      </div>
    </form>
  );
}
