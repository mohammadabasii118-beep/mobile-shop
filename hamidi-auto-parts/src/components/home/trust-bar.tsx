import { BadgeCheck, CreditCard, Headset, PackageCheck, Truck } from "lucide-react";

const ITEMS = [
  { icon: BadgeCheck, t: "ضمانت اصالت کالا", d: "قطعات Genuine و OEM با کد فنی" },
  { icon: Truck, t: "ارسال سریع", d: "تهران ۲۴ ساعته، شهرستان ۴۸ ساعته" },
  { icon: Headset, t: "مشاوره تخصصی", d: "استعلام با شماره شاسی و OEM" },
  { icon: PackageCheck, t: "۷ روز ضمانت بازگشت", d: "در صورت عدم تطابق قطعه" },
  { icon: CreditCard, t: "پرداخت امن", d: "درگاه بانکی و پرداخت در محل" },
];

export function TrustBar() {
  return (
    <div className="container-x relative z-20 -mt-16 lg:-mt-24">
      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-200 shadow-[0_30px_60px_-30px_rgba(0,0,0,.3)] md:grid-cols-5">
        {ITEMS.map((it, i) => (
          <li key={it.t} className={`group flex items-center gap-3 bg-white p-4 transition hover:bg-neutral-50 sm:p-5 ${i === 4 ? "col-span-2 md:col-span-1" : ""}`}>
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-neutral-950 text-white transition group-hover:bg-primary">
              <it.icon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold">{it.t}</p>
              <p className="text-[11px] leading-5 text-neutral-600">{it.d}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
