export default function BrandForm({
  action,
  brand,
}: {
  action: (formData: FormData) => Promise<void>;
  brand?: any;
}) {
  const f = (name: string, def: any = "") => (brand ? brand[name] ?? def : def);
  return (
    <form action={action} className="grid md:grid-cols-2 gap-4 max-w-xl">
      <div>
        <label className="text-sm font-medium block mb-1">نام برند</label>
        <input name="name" defaultValue={f("name")} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">اسلاگ (URL انگلیسی)</label>
        <input name="slug" defaultValue={f("slug")} required pattern="[a-z0-9-]+" className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div className="md:col-span-2">
        <button className="px-8 h-11 rounded-full text-white font-bold text-sm" style={{ background: "var(--ink)" }}>ذخیره برند</button>
      </div>
    </form>
  );
}
