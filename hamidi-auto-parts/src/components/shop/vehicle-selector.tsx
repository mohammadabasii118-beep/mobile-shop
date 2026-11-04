"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CarFront, Search } from "lucide-react";
import { BRANDS, modelsOf, yearsOf, type BrandId } from "@/data/vehicles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn, toFa } from "@/lib/utils";

export function VehicleSelector({ variant = "glass", defaultBrand, className }: { variant?: "glass" | "light"; defaultBrand?: BrandId; className?: string }) {
  const router = useRouter();
  const [brand, setBrand] = useState<BrandId | undefined>(defaultBrand);
  const [model, setModel] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const glass = variant === "glass";

  function submit() {
    const p = new URLSearchParams();
    if (brand) p.set("brand", brand);
    if (model) p.set("model", model);
    if (year) p.set("year", year);
    router.push(`/shop?${p.toString()}`);
  }

  const step = (n: number, label: string) => (
    <span className={cn("mb-2 flex items-center gap-2 text-xs font-semibold", glass ? "text-neutral-300" : "text-neutral-600")}>
      <span className={cn("grid size-5 place-items-center rounded-full text-[10px] font-bold", glass ? "bg-white/10 text-white" : "bg-neutral-950 text-white")}>{toFa(n)}</span>
      {label}
    </span>
  );

  return (
    <div
      className={cn(
        "rounded-3xl p-5 sm:p-6",
        glass ? "border border-white/10 bg-white/[0.06] shadow-2xl backdrop-blur-xl" : "border border-neutral-200 bg-white shadow-[0_30px_60px_-30px_rgba(0,0,0,.25)]",
        className,
      )}
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-primary text-white shadow-[0_8px_20px_-6px_rgba(225,6,0,.8)]"><CarFront className="size-5" /></span>
        <div>
          <h3 className={cn("font-extrabold", glass ? "text-white" : "text-neutral-950")}>قطعه مناسب خودروی خود را پیدا کنید</h3>
          <p className={cn("text-xs", glass ? "text-neutral-400" : "text-neutral-500")}>برند، مدل و سال ساخت را انتخاب کنید</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_0.8fr_auto] md:items-end">
        <div>
          {step(1, "برند خودرو")}
          <div className="grid grid-cols-2 gap-2">
            {BRANDS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => { setBrand(b.id); setModel(""); setYear(""); }}
                className={cn(
                  "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-bold transition",
                  brand === b.id
                    ? "border-primary bg-primary text-white"
                    : glass ? "border-white/15 bg-white/5 text-white hover:border-white/40" : "border-neutral-200 hover:border-neutral-950",
                )}
              >
                <span dir="ltr" className="text-[11px] tracking-widest opacity-70">{b.nameEn}</span>
                {b.nameFa}
              </button>
            ))}
          </div>
        </div>
        <div>
          {step(2, "مدل خودرو")}
          <Select value={model} onValueChange={(v) => { setModel(v); setYear(""); }} disabled={!brand}>
            <SelectTrigger className={cn(glass && "border-white/15 bg-white/5 text-white data-[placeholder]:text-neutral-400")}>
              <SelectValue placeholder={brand ? "انتخاب مدل" : "ابتدا برند را انتخاب کنید"} />
            </SelectTrigger>
            <SelectContent>
              {brand && modelsOf(brand).map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.nameFa} <span className="text-xs text-neutral-400" dir="ltr">{m.nameEn}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          {step(3, "سال ساخت")}
          <Select value={year} onValueChange={setYear} disabled={!model}>
            <SelectTrigger className={cn(glass && "border-white/15 bg-white/5 text-white data-[placeholder]:text-neutral-400")}>
              <SelectValue placeholder="همه سال‌ها" />
            </SelectTrigger>
            <SelectContent>
              {yearsOf(model).map((y) => (
                <SelectItem key={y} value={String(y)}>{toFa(y)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="lg" onClick={submit} disabled={!brand} className="h-11 rounded-xl">
          <Search />
          نمایش قطعات
        </Button>
      </div>
    </div>
  );
}
