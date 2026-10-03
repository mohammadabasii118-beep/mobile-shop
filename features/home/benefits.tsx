import { RotateCcw, ShieldCheck, Truck, Lock } from "lucide-react";

const items = [
  { icon: Truck, title: "ارسال سریع", text: "تهران همان‌روز، شهرستان ۲ تا ۴ روز" },
  { icon: ShieldCheck, title: "ضمانت اصالت", text: "همهٔ کالاها با گارانتی معتبر" },
  { icon: RotateCcw, title: "۷ روز بازگشت", text: "بدون سؤال اضافه" },
  { icon: Lock, title: "پرداخت امن", text: "درگاه‌های بانکی معتبر" },
];

export function Benefits() {
  return (
    <section aria-label="مزایای خرید" className="bg-bg pb-section">
      <div className="container-x grid grid-cols-2 gap-x-4 gap-y-8 border-t border-line pt-10 md:grid-cols-4">
        {items.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex flex-col gap-3 md:flex-row md:items-start">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary"><Icon className="size-5" aria-hidden /></span>
            <div>
              <h3 className="text-base font-bold">{title}</h3>
              <p className="t-small text-muted">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
