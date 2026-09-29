import { getBankSettings } from "@/lib/bankSettings";
import { getSiteSettings } from "@/lib/siteSettings";
import { saveBankSettings, saveSiteSettings } from "@/lib/actions/settings";

export default async function AdminSettingsPage() {
  const [bank, site] = await Promise.all([getBankSettings(), getSiteSettings()]);

  return (
    <div className="max-w-md flex flex-col gap-12">
      <div>
        <h1 className="text-2xl font-extrabold mb-2">تنظیمات کارت بانکی</h1>
        <p className="text-sm muted mb-6">این اطلاعات دقیقاً همانی است که هنگام انتخاب «کارت‌به‌کارت» در تسویه‌حساب به مشتری نمایش داده می‌شود.</p>
        <form action={saveBankSettings} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">شماره کارت</label>
            <input name="cardNumber" dir="ltr" defaultValue={bank.cardNumber} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm font-mono" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">نام صاحب کارت</label>
            <input name="cardHolderName" defaultValue={bank.cardHolderName} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">نام بانک</label>
            <input name="bankName" defaultValue={bank.bankName} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
          </div>
          <button className="px-8 h-11 rounded-full text-white font-bold text-sm w-fit" style={{ background: "var(--ink)" }}>ذخیره تنظیمات</button>
        </form>
      </div>

      <div>
        <h2 className="text-xl font-extrabold mb-2">سئو، شبکه‌های اجتماعی و هشدار موجودی</h2>
        <p className="text-sm muted mb-6">
          عنوان و توضیحات سایت در متادیتای صفحات (برای گوگل و پیش‌نمایش لینک‌ها) استفاده می‌شود؛ در صورت خالی گذاشتن، مقدار پیش‌فرض سایت جایگزین می‌شود.
          لینک‌های شبکه اجتماعی فقط در صورت پر بودن در فوتر نمایش داده می‌شوند — هیچ لینک نمایشی/جعلی وجود ندارد.
        </p>
        <form action={saveSiteSettings} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">عنوان سایت (اختیاری)</label>
            <input name="siteTitle" defaultValue={site.siteTitle || ""} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">توضیحات سایت (اختیاری)</label>
            <textarea name="siteDescription" defaultValue={site.siteDescription || ""} rows={3} className="w-full rounded-lg border line bg-transparent px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">کلمات کلیدی متا (اختیاری، با ویرگول جدا شوند)</label>
            <input name="metaKeywords" defaultValue={site.metaKeywords || ""} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">لینک اینستاگرام (اختیاری)</label>
            <input name="instagramUrl" dir="ltr" defaultValue={site.instagramUrl || ""} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">لینک تلگرام (اختیاری)</label>
            <input name="telegramUrl" dir="ltr" defaultValue={site.telegramUrl || ""} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">لینک واتس‌اپ (اختیاری)</label>
            <input name="whatsappUrl" dir="ltr" defaultValue={site.whatsappUrl || ""} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">آستانه هشدار موجودی کم (عدد)</label>
            <input name="lowStockThreshold" type="number" min={0} defaultValue={site.lowStockThreshold} required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
            <p className="text-xs muted mt-1">وقتی موجودی یک محصول/تنوع در اثر یک خرید واقعی به این عدد یا کمتر برسد، قانون‌های خودکار با رویداد «موجودی کم» اجرا می‌شوند (مثلاً ثبت هشدار در /admin/alerts).</p>
          </div>
          <button className="px-8 h-11 rounded-full text-white font-bold text-sm w-fit" style={{ background: "var(--ink)" }}>ذخیره تنظیمات</button>
        </form>
      </div>
    </div>
  );
}
