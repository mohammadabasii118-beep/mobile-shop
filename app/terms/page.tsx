import type { Metadata } from "next";
export const metadata: Metadata = { title: "قوانین و مقررات" };

const sections = [
  { t: "ثبت سفارش", d: "با ثبت سفارش در کیس لاین، شما شرایط و قوانین این صفحه را می‌پذیرید. اطلاعات ارسالی باید صحیح و کامل باشد." },
  { t: "قیمت‌گذاری", d: "قیمت‌های درج‌شده به تومان و شامل تمام هزینه‌های محصول است، مگر در مورد هزینه ارسال که جداگانه محاسبه می‌شود." },
  { t: "ارسال", d: "سفارش‌ها طی ۲۴ تا ۷۲ ساعت کاری پردازش و ارسال می‌شوند. زمان تحویل بسته به شهر مقصد متغیر است." },
  { t: "بازگشت کالا", d: "در صورت عدم رضایت از کالا، تا ۷ روز پس از دریافت امکان بازگشت کالای سالم و بدون استفاده وجود دارد." },
  { t: "حریم خصوصی", d: "اطلاعات شخصی کاربران صرفاً برای پردازش سفارش استفاده می‌شود و در اختیار اشخاص ثالث قرار نمی‌گیرد." },
];

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-14">
      <h1 className="text-2xl font-extrabold mb-8">قوانین و مقررات</h1>
      <div className="flex flex-col gap-6">
        {sections.map((s) => (
          <div key={s.t}>
            <h2 className="font-bold mb-2">{s.t}</h2>
            <p className="text-sm muted leading-7">{s.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
