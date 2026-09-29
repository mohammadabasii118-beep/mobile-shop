import { db } from "@/lib/db";

export default async function PhoneModelForm({
  action,
  model,
}: {
  action: (formData: FormData) => Promise<void>;
  model?: any;
}) {
  const brands = await db.brand.findMany({ orderBy: { name: "asc" } });
  const f = (name: string, def: any = "") => (model ? model[name] ?? def : def);
  return (
    <form action={action} className="grid md:grid-cols-2 gap-4 max-w-xl">
      <div>
        <label className="text-sm font-medium block mb-1">برند</label>
        <select name="brandId" defaultValue={f("brandId", "")} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm">
          <option value="">انتخاب کنید</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">نام مدل (مثلاً آیفون ۱۴)</label>
        <input name="name" defaultValue={f("name")} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">اسلاگ (URL انگلیسی)</label>
        <input name="slug" defaultValue={f("slug")} required pattern="[a-z0-9-]+" className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div className="md:col-span-2">
        <button className="px-8 h-11 rounded-full text-white font-bold text-sm" style={{ background: "var(--ink)" }}>ذخیره مدل</button>
      </div>
    </form>
  );
}
