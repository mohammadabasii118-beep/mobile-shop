import { db } from "@/lib/db";
import HomepageSectionRow from "@/components/admin/HomepageSectionRow";
import { NewCustomBlockForm } from "@/components/admin/CustomBlockForm";
import { saveBanner } from "@/lib/actions/homepage";

export default async function AdminHomepagePage() {
  const [sections, banner] = await Promise.all([
    db.homepageSection.findMany({ orderBy: { order: "asc" } }),
    db.banner.findFirst({ orderBy: { order: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-extrabold mb-2">مدیریت صفحه اصلی</h1>
      <p className="text-sm muted mb-6">ترتیب و فعال/غیرفعال بودن بخش‌های صفحه اصلی را اینجا مدیریت کنید. محصولات هر بخش (پرفروش/جدید/ترند) از صفحه «محصولات» با تیک زدن گزینه مربوطه انتخاب می‌شوند.</p>

      <h2 className="font-bold mb-3 text-sm">ترتیب بخش‌ها</h2>
      <div className="flex flex-col gap-2 mb-4">
        {sections.map((s) => <HomepageSectionRow key={s.id} section={s} />)}
      </div>
      <div className="mb-10">
        <NewCustomBlockForm />
        <p className="text-xs muted mt-2">
          بخش‌های ثابت (Hero، پرفروش‌ترین‌ها و مانند آن) فقط قابل ترتیب‌دهی/فعال-غیرفعال‌کردن هستند؛ «بلوک محتوای دلخواه» تنها نوعی است که خودتان محتوایش را می‌نویسید و می‌توانید حذفش کنید — دقیقاً همان‌جا در فهرست بالا، بعد از افزودن.
        </p>
      </div>

      <h2 className="font-bold mb-3 text-sm">بنر میانی صفحه اصلی</h2>
      <form action={saveBanner} className="grid gap-4 max-w-md">
        <input type="hidden" name="id" defaultValue={banner?.id || ""} />
        <div>
          <label className="text-sm font-medium block mb-1">عنوان</label>
          <input name="title" defaultValue={banner?.title || ""} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">زیرعنوان</label>
          <input name="subtitle" defaultValue={banner?.subtitle || ""} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">لینک مقصد</label>
          <input name="linkUrl" defaultValue={banner?.linkUrl || ""} placeholder="/category/accessory" className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={banner?.isActive ?? true} /> فعال
        </label>
        <button className="px-8 h-11 rounded-full text-white font-bold text-sm w-fit" style={{ background: "var(--ink)" }}>ذخیره بنر</button>
      </form>
    </div>
  );
}
