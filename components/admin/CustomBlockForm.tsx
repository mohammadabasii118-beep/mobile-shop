"use client";
import { useState } from "react";
import { createCustomBlock, updateCustomBlock, deleteCustomBlock } from "@/lib/actions/homepage";
import ImageUploadField from "./ImageUploadField";

type CustomBlockConfig = { title?: string; body?: string; imageUrl?: string; linkUrl?: string; linkLabel?: string };

export function NewCustomBlockForm() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="px-5 h-10 rounded-full border line text-sm font-medium">
        + افزودن بلوک محتوای دلخواه
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        setSaving(true);
        await createCustomBlock(fd);
        setSaving(false);
        setOpen(false);
      }}
      className="surface border line rounded-2xl p-4 grid gap-3 max-w-md"
    >
      <p className="text-sm font-bold">بلوک محتوای جدید</p>
      <input name="title" placeholder="عنوان (الزامی)" required className="h-10 rounded-lg border line bg-transparent px-3 text-sm" />
      <textarea name="body" placeholder="متن (اختیاری)" rows={3} className="rounded-lg border line bg-transparent px-3 py-2 text-sm" />
      <ImageUploadField name="imageUrl" label="تصویر (اختیاری)" />
      <input name="linkUrl" placeholder="لینک دکمه (اختیاری، مثلاً /category/case)" className="h-10 rounded-lg border line bg-transparent px-3 text-sm" />
      <input name="linkLabel" placeholder="متن دکمه (اختیاری، مثلاً «مشاهده»)" className="h-10 rounded-lg border line bg-transparent px-3 text-sm" />
      <div className="flex gap-2">
        <button disabled={saving} className="px-5 h-10 rounded-full text-white text-sm font-bold disabled:opacity-60" style={{ background: "var(--ink)" }}>
          {saving ? "در حال ذخیره…" : "ذخیره بلوک"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-5 h-10 rounded-full border line text-sm">انصراف</button>
      </div>
    </form>
  );
}

export function EditCustomBlockForm({ id, config }: { id: string; config: CustomBlockConfig }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-medium underline underline-offset-4">
        ویرایش محتوا
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        setSaving(true);
        await updateCustomBlock(id, fd);
        setSaving(false);
        setOpen(false);
      }}
      className="surface2 rounded-xl p-4 grid gap-3 mt-2"
    >
      <input name="title" defaultValue={config.title || ""} placeholder="عنوان" required className="h-10 rounded-lg border line bg-transparent px-3 text-sm" />
      <textarea name="body" defaultValue={config.body || ""} placeholder="متن" rows={3} className="rounded-lg border line bg-transparent px-3 py-2 text-sm" />
      <ImageUploadField name="imageUrl" defaultValue={config.imageUrl || ""} label="تصویر" />
      <input name="linkUrl" defaultValue={config.linkUrl || ""} placeholder="لینک دکمه" className="h-10 rounded-lg border line bg-transparent px-3 text-sm" />
      <input name="linkLabel" defaultValue={config.linkLabel || ""} placeholder="متن دکمه" className="h-10 rounded-lg border line bg-transparent px-3 text-sm" />
      <div className="flex gap-2">
        <button disabled={saving} className="px-5 h-9 rounded-full text-white text-xs font-bold disabled:opacity-60" style={{ background: "var(--ink)" }}>
          {saving ? "در حال ذخیره…" : "ذخیره"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-5 h-9 rounded-full border line text-xs">بستن</button>
        <button
          type="button"
          onClick={() => { if (confirm("این بلوک حذف شود؟")) deleteCustomBlock(id); }}
          className="px-5 h-9 rounded-full text-xs font-bold"
          style={{ background: "#f6eae6", color: "#a24e56" }}
        >
          حذف بلوک
        </button>
      </div>
    </form>
  );
}
