import { ArrowUpLeft } from "lucide-react";
import { categories } from "@/data/mock";
import { ProductArt } from "@/components/product/product-art";
import { SectionHeader } from "@/components/ui/section-header";
import { Reveal } from "@/components/ui/reveal";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Bento نامتقارن (DESIGN.md §11)؛ فقط یک کاشی تیره برای ایجاد سلسله‌مراتب */
const layout: Record<string, string> = {
  cases: "col-span-2 md:col-span-6 md:row-span-2 surface-dark bg-surface text-fg min-h-80 md:min-h-[26rem]",
  charging: "col-span-2 md:col-span-6 bg-stage min-h-48",
  audio: "col-span-1 md:col-span-3 bg-stage min-h-56",
  power: "col-span-1 md:col-span-3 bg-stage min-h-56",
  protection: "col-span-2 md:col-span-12 bg-stage min-h-40",
};

const art = { cases: "size-72 md:size-[26rem]", charging: "size-44 md:size-60", audio: "size-40 md:size-48", power: "size-40 md:size-48", protection: "size-40 md:size-52" } as Record<string, string>;

export function Categories() {
  return (
    <section id="categories" className="bg-bg py-section">
      <div className="container-x">
        <SectionHeader eyebrow="دسته‌بندی‌ها" title="همه‌چیز برای گوشی‌ات" description="از قاب تا شارژر؛ هر دسته با فیلتر مدل گوشی، فقط محصولات سازگار را نشان می‌دهد." href="#best-sellers" linkLabel="همهٔ محصولات" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-12 md:gap-4">
          {categories.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.05} className={cn("contents")}>
              <a
                href="#best-sellers"
                className={cn("group relative flex overflow-hidden rounded-2xl p-5 transition-shadow duration-300 hover:shadow-card md:p-7", layout[c.id])}
              >
                <div className="relative z-10 flex flex-col justify-between self-stretch">
                  <div>
                    <h3 className="t-h2">{c.name}</h3>
                    <p className="t-small num mt-1 text-muted">{formatNumber(c.count)} محصول</p>
                  </div>
                  <span className="mt-6 grid size-11 place-items-center rounded-full bg-primary text-primary-fg transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-[-2px]" aria-hidden>
                    <ArrowUpLeft className="size-5" />
                  </span>
                  <span className="sr-only">مشاهدهٔ {c.name}</span>
                </div>
                <div className="pointer-events-none absolute -bottom-4 end-2 transition-transform duration-500 ease-out group-hover:-translate-y-1 group-hover:scale-105 md:end-6">
                  <ProductArt kind={c.kind} color={c.color} className={art[c.id]} label="" />
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
