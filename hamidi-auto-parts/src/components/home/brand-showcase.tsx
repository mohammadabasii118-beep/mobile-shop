import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BRANDS, modelsOf } from "@/data/vehicles";
import Image from "next/image";
import { countProducts } from "@/lib/catalog";
import { toFa } from "@/lib/utils";

const ART: Record<string, string[]> = {
  nissan: ["/images/parts/shock-absorber.png"],
  honda: ["/images/parts/timing-belt.png"],
};

export function BrandShowcase() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {BRANDS.map((b, idx) => {
        const models = modelsOf(b.id);
        const count = countProducts({ brand: b.id });
        const dark = idx === 0;
        return (
          <div key={b.id} className={`group relative overflow-hidden rounded-3xl p-6 sm:p-8 ${dark ? "carbon text-white" : "border border-neutral-200 bg-gradient-to-br from-neutral-50 to-neutral-100"}`}>
            <span aria-hidden className={`pointer-events-none absolute -bottom-6 -left-4 text-[7rem] leading-none font-black tracking-tighter sm:text-[9rem] ${dark ? "text-white/[0.04]" : "text-neutral-950/[0.04]"}`} dir="ltr">{b.nameEn}</span>
            <div className="pointer-events-none absolute hidden sm:block -top-20 -left-20 size-64 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative grid gap-6 sm:grid-cols-[1fr_180px]">
              <div>
                <span className={`text-xs font-black tracking-[0.3em] ${dark ? "text-[#ff5a4f]" : "text-primary"}`} dir="ltr">{b.nameEn}</span>
                <h3 className="mt-2 text-3xl font-black">لوازم یدکی {b.nameFa}</h3>
                <p className={`mt-2 text-sm leading-7 ${dark ? "text-neutral-300" : "text-neutral-700"}`}>
                  {b.id === "nissan" ? "تخصص ما در مورانو، ماکسیما، تیانا، ایکس‌تریل، جوک و اکسل." : "پوشش کامل مدل‌های هوندا از ۱۹۹۰ تا ۲۰۱۷؛ آکورد، سیویک، سی‌آر‌وی و …"}
                  {" "}<b className={dark ? "text-white" : "text-neutral-950"}>{toFa(count)}</b> محصول آماده ارسال.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {models.slice(0, b.id === "nissan" ? 6 : 8).map((m) => (
                    <Link key={m.id} href={`/${b.id}/${m.id}`} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${dark ? "bg-white/10 hover:bg-primary" : "bg-white shadow-sm ring-1 ring-neutral-200 hover:bg-neutral-950 hover:text-white"}`}>
                      {m.nameFa}
                    </Link>
                  ))}
                  {models.length > 8 && <Link href={`/${b.id}`} className="rounded-full px-3 py-1.5 text-xs font-semibold text-primary">+{toFa(models.length - 8)} مدل دیگر</Link>}
                </div>
                <Link href={`/${b.id}`} className={`mt-7 inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-sm font-bold transition ${dark ? "bg-primary text-white hover:bg-red-700" : "bg-neutral-950 text-white hover:bg-primary"}`}>
                  ورود به فروشگاه {b.nameFa} <ArrowLeft className="size-4 transition group-hover:-translate-x-1" />
                </Link>
              </div>
              <div className="relative hidden h-full min-h-48 sm:block">
                <Image src={ART[b.id][0]} alt="" fill sizes="180px" className="object-contain drop-shadow-2xl transition duration-700 group-hover:scale-110 group-hover:-rotate-6" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
