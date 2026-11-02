export const metadata = { title: "قوانین و مقررات" };

const sections = [
  {
    h: "۱. پذیرش قوانین",
    p: "با استفاده از این فروشگاه، کاربر می‌پذیرد که قوانین و مقررات زیر را مطالعه کرده و با آن موافق است. (متن نمایشی)",
  },
  {
    h: "۲. ثبت سفارش",
    p: "کاربر مسئول صحت اطلاعات واردشده هنگام ثبت سفارش است. سفارش‌ها پس از تأیید پرداخت پردازش می‌شوند.",
  },
  {
    h: "۳. ارسال و تحویل",
    p: "زمان ارسال بسته به موقعیت جغرافیایی و نوع کالا متفاوت است. در صورت تأخیر، پشتیبانی موضوع را اطلاع‌رسانی می‌کند.",
  },
  {
    h: "۴. بازگشت کالا",
    p: "امکان بازگشت کالای سالم تا ۷ روز پس از تحویل وجود دارد، مشروط بر حفظ بسته‌بندی و شرایط اولیه‌ی کالا.",
  },
  {
    h: "۵. حریم خصوصی",
    p: "اطلاعات کاربران تنها برای پردازش سفارش و بهبود خدمات استفاده می‌شود و در اختیار اشخاص ثالث قرار نمی‌گیرد.",
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-black text-silver-50">قوانین و مقررات</h1>
      <p className="mt-2 text-sm text-silver-500">
        این متن صرفاً برای نمایش دمو تهیه شده و جنبه‌ی حقوقی ندارد.
      </p>

      <div className="mt-8 space-y-5">
        {sections.map((s) => (
          <section key={s.h} className="glass rounded-2xl p-5">
            <h2 className="mb-2 text-sm font-bold text-silver-100">{s.h}</h2>
            <p className="text-sm leading-7 text-silver-400">{s.p}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
