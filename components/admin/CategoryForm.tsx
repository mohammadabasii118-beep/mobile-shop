import ImageUploadField from "./ImageUploadField";
import { db } from "@/lib/db";

export default async function CategoryForm({
  action,
  category,
}: {
  action: (formData: FormData) => Promise<void>;
  category?: any;
}) {
  const parents = await db.category.findMany({ where: { parentId: null, ...(category ? { id: { not: category.id } } : {}) }, orderBy: { name: "asc" } });
  const f = (name: string, def: any = "") => (category ? category[name] ?? def : def);

  return (
    <form action={action} className="grid md:grid-cols-2 gap-4 max-w-2xl">
      <div>
        <label className="text-sm font-medium block mb-1">نام دسته‌بندی</label>
        <input name="name" defaultValue={f("name")} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">اسلاگ (URL انگلیسی)</label>
        <input name="slug" defaultValue={f("slug")} required pattern="[a-z0-9-]+" className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">دسته‌ی والد (اختیاری)</label>
        <select name="parentId" defaultValue={f("parentId", "")} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm">
          <option value="">— دسته‌ی اصلی —</option>
          {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">ترتیب نمایش</label>
        <input name="order" type="number" defaultValue={f("order", 0)} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div className="md:col-span-2">
        <ImageUploadField name="imageUrl" defaultValue={f("imageUrl", "")} label="تصویر دسته‌بندی" />
      </div>
      <div className="md:col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={f("isActive", true)} /> فعال
      </div>
      <div className="md:col-span-2">
        <button className="px-8 h-11 rounded-full text-white font-bold text-sm" style={{ background: "var(--ink)" }}>ذخیره دسته‌بندی</button>
      </div>
    </form>
  );
}
