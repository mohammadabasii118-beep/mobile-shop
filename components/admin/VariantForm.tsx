"use client";
import { useMemo, useState } from "react";
import ImageUploadField from "./ImageUploadField";

type Brand = { id: string; name: string };
type PhoneModel = { id: string; name: string; brandId: string | null };
type Color = { id: string; name: string; hexCode: string | null };

export default function VariantForm({
  action,
  brands,
  models,
  colors,
  variant,
}: {
  action: (formData: FormData) => Promise<void>;
  brands: Brand[];
  models: PhoneModel[];
  colors: Color[];
  variant?: any;
}) {
  const f = (name: string, def: any = "") => (variant ? variant[name] ?? def : def);
  const [brandId, setBrandId] = useState<string>(f("brandId", ""));

  const filteredModels = useMemo(
    () => models.filter((m) => !brandId || m.brandId === brandId),
    [models, brandId]
  );

  return (
    <form action={action} className="grid md:grid-cols-2 gap-4 max-w-2xl">
      <div>
        <label className="text-sm font-medium block mb-1">برند (اختیاری)</label>
        <select
          name="brandId"
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm"
        >
          <option value="">—</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">مدل گوشی (اختیاری)</label>
        <select name="phoneModelId" defaultValue={f("phoneModelId", "")} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm">
          <option value="">—</option>
          {filteredModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">رنگ (اختیاری)</label>
        <select name="colorId" defaultValue={f("colorId", "")} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm">
          <option value="">—</option>
          {colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">کد محصول / SKU (اختیاری)</label>
        <input name="sku" defaultValue={f("sku", "")} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
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
        <p className="text-xs muted mt-1">فقط به همکاران تأییدشده نمایش داده می‌شود.</p>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">موجودی</label>
        <input name="stock" type="number" defaultValue={f("stock", 0)} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div className="md:col-span-2">
        <ImageUploadField name="imageUrl" defaultValue={f("imageUrl", "")} label="تصویر این ترکیب (اختیاری)" />
      </div>
      <div className="md:col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={f("isActive", true)} /> فعال
      </div>
      <div className="md:col-span-2">
        <button className="px-8 h-11 rounded-full text-white font-bold text-sm" style={{ background: "var(--ink)" }}>ذخیره ترکیب</button>
      </div>
    </form>
  );
}
