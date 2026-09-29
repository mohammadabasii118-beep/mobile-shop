export default function PageForm({ action, page }: { action: (formData: FormData) => Promise<void>; page?: any }) {
  const f = (name: string, def: any = "") => (page ? page[name] ?? def : def);

  return (
    <form action={action} className="grid gap-4 max-w-2xl">
      <div>
        <label className="text-sm font-medium block mb-1">عنوان</label>
        <input name="title" defaultValue={f("title")} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">اسلاگ (آدرس، انگلیسی)</label>
        <input name="slug" defaultValue={f("slug")} required pattern="[a-z0-9-]+" placeholder="about-us" className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
        <p className="text-xs muted mt-1">صفحه در آدرس /page/&lt;اسلاگ&gt; نمایش داده می‌شود.</p>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">متن صفحه</label>
        <textarea name="body" defaultValue={f("body")} required rows={12} className="w-full rounded-lg border line bg-transparent px-3 py-2 text-sm" />
        <p className="text-xs muted mt-1">هر پاراگراف را با یک خط خالی از پاراگراف بعدی جدا کنید. متن به‌صورت ساده نمایش داده می‌شود (بدون HTML).</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublished" defaultChecked={f("isPublished", true)} /> منتشرشده (در غیر این صورت فقط پیش‌نویس است و در سایت نمایش داده نمی‌شود)
      </label>
      <button className="px-8 h-11 rounded-full text-white font-bold text-sm w-fit" style={{ background: "var(--ink)" }}>ذخیره صفحه</button>
    </form>
  );
}
