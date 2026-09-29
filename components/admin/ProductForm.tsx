import MultiImageUploadField from "./MultiImageUploadField";
import { db } from "@/lib/db";

export default async function ProductForm({
  action,
  product,
}: {
  action: (formData: FormData) => Promise<void>;
  product?: any;
}) {
  const [categories, brands, models] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.brand.findMany({ orderBy: { name: "asc" } }),
    db.phoneModel.findMany({ orderBy: { name: "asc" } }),
  ]);

  const f = (name: string, def: any = "") => (product ? product[name] ?? def : def);

  const specsText = product?.specs && typeof product.specs === "object"
    ? Object.entries(product.specs as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join("\n")
    : "";

  return (
    <form action={action} className="grid md:grid-cols-2 gap-4 max-w-3xl">
      <div className="md:col-span-2">
        <label className="text-sm font-medium block mb-1">نام محصول</label>
        <input name="name" defaultValue={f("name")} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">اسلاگ (URL انگلیسی)</label>
        <input name="slug" defaultValue={f("slug")} required pattern="[a-z0-9-]+" className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">دسته‌بندی</label>
        <select name="categoryId" defaultValue={f("categoryId")} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm">
          <option value="">انتخاب کنید</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">برند (اختیاری)</label>
        <select name="brandId" defaultValue={f("brandId", "")} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm">
          <option value="">—</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">مدل گوشی (اختیاری)</label>
        <select name="phoneModelId" defaultValue={f("phoneModelId", "")} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm">
          <option value="">—</option>
          {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">قیمت (تومان)</label>
        <input name="price" type="number" defaultValue={f("price")} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">قیمت قبلی (اختیاری)</label>
        <input name="oldPrice" type="number" defaultValue={f("oldPrice", "")} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">قیمت عمده‌فروشی (اختیاری)</label>
        <input name="wholesalePrice" type="number" defaultValue={f("wholesalePrice", "")} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
        <p className="text-xs muted mt-1">فقط به همکاران تأییدشده (عمده‌فروش) نمایش داده و از آن‌ها دریافت می‌شود. اگر خالی بماند، همکاران هم قیمت عادی را می‌بینند.</p>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">قیمت خرید/تأمین‌کننده (اختیاری)</label>
        <input name="costPrice" type="number" defaultValue={f("costPrice", "")} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">موجودی</label>
        <input name="stock" type="number" defaultValue={f("stock", 0)} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div className="md:col-span-2">
        <label className="text-sm font-medium block mb-1">توضیحات</label>
        <textarea name="description" rows={4} defaultValue={f("description")} required className="w-full rounded-lg border line bg-transparent px-3 py-2 text-sm" />
      </div>
      <div className="md:col-span-2">
        <label className="text-sm font-medium block mb-1">مشخصات فنی (اختیاری — برای جدول مقایسه)</label>
        <textarea
          name="specsText"
          rows={4}
          defaultValue={specsText}
          placeholder={"هر مورد در یک خط، به‌صورت «عنوان: مقدار»، مثلاً:\nجنس: سیلیکون\nوزن: ۲۰ گرم"}
          className="w-full rounded-lg border line bg-transparent px-3 py-2 text-sm"
        />
        <p className="text-xs muted mt-1">این مشخصات در صفحه‌ی محصول و در صفحه‌ی مقایسه‌ی محصولات (/compare) نمایش داده می‌شود.</p>
      </div>
      <div className="md:col-span-2">
        <MultiImageUploadField name="images" defaultValue={product?.images || []} />
      </div>
      <div className="md:col-span-2 flex flex-wrap gap-5 text-sm py-2">
        {[
          ["isActive", "فعال", f("isActive", true)],
          ["isBestSeller", "پرفروش", f("isBestSeller", false)],
          ["isNew", "جدید", f("isNew", false)],
          ["isFeatured", "ویژه", f("isFeatured", false)],
          ["isTrending", "ترند", f("isTrending", false)],
        ].map(([name, label, def]) => (
          <label key={name as string} className="flex items-center gap-2">
            <input type="checkbox" name={name as string} defaultChecked={!!def} /> {label}
          </label>
        ))}
      </div>
      <div className="md:col-span-2 surface2 rounded-xl p-4">
        <label className="flex items-center gap-2 text-sm font-medium mb-1">
          <input type="checkbox" name="hasVariants" defaultChecked={f("hasVariants", false)} /> این محصول متغیر است (برند/مدل/رنگ)
        </label>
        <p className="text-xs muted leading-6">
          وقتی فعال باشد، قیمت و موجودی بالا نادیده گرفته می‌شود و مشتری باید یک ترکیب (مثلاً برند، مدل و رنگ) را انتخاب کند.
          پس از ذخیره این محصول، از دکمه «مدیریت متغیرها» برای تعریف ترکیب‌ها استفاده کنید.
        </p>
      </div>
      <div className="md:col-span-2">
        <button className="px-8 h-11 rounded-full text-white font-bold text-sm" style={{ background: "var(--ink)" }}>ذخیره محصول</button>
      </div>
    </form>
  );
}
