"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CarFront, ChevronDown, Search } from "lucide-react";
import { BRANDS, MODELS, yearsOf, type BrandId } from "@/data/vehicles";
import { cn, toFa } from "@/lib/utils";

/**
 * Brand → model → year finder. It is a real GET form posting to /vehicle
 * (which redirects to the clean model URL), so it also works before
 * hydration or without JavaScript; with JS it navigates client-side.
 */
export function VehicleSelector({ variant = "light", defaultBrand, className }: { variant?: "glass" | "light"; defaultBrand?: BrandId; className?: string }) {
  const router = useRouter();
  const [brand, setBrand] = useState<BrandId | "">(defaultBrand ?? "");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const glass = variant === "glass";
  const models = MODELS.filter((m) => !brand || m.brand === brand);

  const field = cn(
    "h-11 w-full cursor-pointer appearance-none rounded-xl border px-4 pl-9 text-sm outline-none transition focus-visible:ring-[3px] focus-visible:ring-neutral-950/15 disabled:cursor-not-allowed disabled:opacity-60",
    glass ? "border-white/15 bg-white/5 text-white" : "border-neutral-300 bg-white text-neutral-950",
  );
  const step = (n: number, label: string, htmlFor?: string) => (
    <label htmlFor={htmlFor} className={cn("mb-2 flex items-center gap-2 text-xs font-semibold", glass ? "text-neutral-300" : "text-neutral-700")}>
      <span className="grid size-5 place-items-center rounded-full bg-neutral-950 text-[10px] font-bold text-white" aria-hidden>{toFa(n)}</span>
      {label}
    </label>
  );

  return (
    <form
      action="/vehicle"
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        if (!brand) return;
        const m = MODELS.find((x) => x.id === model && x.brand === brand);
        router.push(m ? `/${brand}/${m.id}${year ? `?year=${year}` : ""}` : `/${brand}`);
      }}
      className={cn("rounded-3xl p-5 sm:p-6", glass ? "border border-white/10 bg-white/[0.06] backdrop-blur-xl" : "border border-neutral-200 bg-white shadow-[0_30px_60px_-30px_rgba(0,0,0,.25)]", className)}
      aria-labelledby="vehicle-finder-title"
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-primary text-white" aria-hidden><CarFront className="size-5" /></span>
        <div>
          <h2 id="vehicle-finder-title" className={cn("font-extrabold", glass ? "text-white" : "text-neutral-950")}>قطعه مناسب خودروی خود را پیدا کنید</h2>
          <p className={cn("text-xs", glass ? "text-neutral-300" : "text-neutral-600")}>برند، مدل و سال ساخت را انتخاب کنید</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_0.8fr_auto] md:items-end">
        <fieldset>
          <legend className="sr-only">برند خودرو</legend>
          {step(1, "برند خودرو")}
          <div className="grid grid-cols-2 gap-2">
            {BRANDS.map((b) => (
              <label key={b.id} className={cn("flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-bold transition has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-neutral-950/20", brand === b.id ? "border-primary bg-primary text-white" : glass ? "border-white/15 bg-white/5 text-white" : "border-neutral-300 hover:border-neutral-950")}>
                <input type="radio" name="brand" value={b.id} checked={brand === b.id} onChange={() => { setBrand(b.id); setModel(""); setYear(""); }} className="sr-only" required />
                <span dir="ltr" className="text-[11px] tracking-widest opacity-80">{b.nameEn}</span>
                {b.nameFa}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="relative">
          {step(2, "مدل خودرو", "vf-model")}
          <select id="vf-model" name="model" value={model} onChange={(e) => { setModel(e.target.value); setYear(""); }} className={field}>
            <option value="">{brand ? "همه مدل‌ها" : "ابتدا برند را انتخاب کنید"}</option>
            {BRANDS.filter((b) => !brand || b.id === brand).map((b) => (
              <optgroup key={b.id} label={b.nameFa}>
                {models.filter((m) => m.brand === b.id).map((m) => <option key={m.id} value={m.id}>{m.nameFa} ({m.nameEn})</option>)}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute bottom-3.5 left-3 size-4 opacity-60" aria-hidden />
        </div>
        <div className="relative">
          {step(3, "سال ساخت", "vf-year")}
          <select id="vf-year" name="year" value={year} onChange={(e) => setYear(e.target.value)} disabled={!model} className={field}>
            <option value="">همه سال‌ها</option>
            {yearsOf(model).map((y) => <option key={y} value={y}>{toFa(y)}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute bottom-3.5 left-3 size-4 opacity-60" aria-hidden />
        </div>
        <button type="submit" className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white shadow-[0_8px_20px_-8px_rgba(225,6,0,.7)] transition hover:bg-brand-red-dark">
          <Search className="size-4" aria-hidden />
          نمایش قطعات
        </button>
      </div>
    </form>
  );
}
