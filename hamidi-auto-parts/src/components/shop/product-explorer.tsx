"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownWideNarrow, PackageSearch, Search, SlidersHorizontal, X } from "lucide-react";
import { BRANDS, MODELS, getModel, modelsOf, yearsOf, type BrandId } from "@/data/vehicles";
import { CATEGORIES, getCategory } from "@/data/categories";
import { PRODUCTS } from "@/data/products";
import { SORT_OPTIONS, queryProducts, type SortKey } from "@/lib/catalog";
import { ProductCard } from "./product-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn, formatPrice, toFa } from "@/lib/utils";

const PRICE_RANGES = [
  { id: "0-1", label: "تا ۱ میلیون", min: 0, max: 1_000_000 },
  { id: "1-5", label: "۱ تا ۵ میلیون", min: 1_000_000, max: 5_000_000 },
  { id: "5-20", label: "۵ تا ۲۰ میلیون", min: 5_000_000, max: 20_000_000 },
  { id: "20+", label: "بیش از ۲۰ میلیون", min: 20_000_000, max: Infinity },
];

const PAGE = 12;

export function ProductExplorer({ fixedBrand, fixedCategory, showSearch = true }: { fixedBrand?: BrandId; fixedCategory?: string; showSearch?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const q = sp.get("q") ?? "";
  const brand = (fixedBrand ?? sp.get("brand") ?? "") as BrandId | "";
  const model = sp.get("model") ?? "";
  const year = sp.get("year") ?? "";
  const catParam = fixedCategory ?? sp.get("cat") ?? "";
  const cats = useMemo(() => catParam.split(",").filter(Boolean), [catParam]);
  const sort = (sp.get("sort") as SortKey) || "popular";
  const inStock = sp.get("stock") === "1";
  const price = sp.get("price") ?? "";

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    setLimit(PAGE);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const results = useMemo(() => {
    const range = PRICE_RANGES.find((r) => r.id === price);
    return queryProducts({
      q,
      brand: brand || undefined,
      model: model || undefined,
      year: year ? Number(year) : undefined,
      categories: cats,
      inStock,
      sort,
    }).filter((p) => !range || (p.price >= range.min && p.price < range.max));
  }, [q, brand, model, year, cats, inStock, sort, price]);

  const chips: { label: string; clear: Record<string, string | null> }[] = [];
  if (q) chips.push({ label: `«${q}»`, clear: { q: null } });
  if (!fixedBrand && brand) chips.push({ label: BRANDS.find((b) => b.id === brand)!.nameFa, clear: { brand: null, model: null, year: null } });
  if (model) chips.push({ label: getModel(model)?.nameFa ?? model, clear: { model: null, year: null } });
  if (year) chips.push({ label: `مدل ${toFa(year)}`, clear: { year: null } });
  if (!fixedCategory) cats.forEach((c) => chips.push({ label: getCategory(c)?.nameFa ?? c, clear: { cat: cats.filter((x) => x !== c).join(",") || null } }));
  if (price) chips.push({ label: PRICE_RANGES.find((r) => r.id === price)?.label ?? "", clear: { price: null } });
  if (inStock) chips.push({ label: "فقط موجود", clear: { stock: null } });

  const clearAll = () => update({ q: null, brand: null, model: null, year: null, cat: null, price: null, stock: null });

  const filters = (
    <FilterPanel
      {...{ q, brand, model, year, cats, inStock, price, fixedBrand, fixedCategory, showSearch, update }}
    />
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-44 max-h-[calc(100dvh-12rem)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 no-scrollbar">{filters}</div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="bottom" dir="rtl" className="gap-0 p-0">
          <SheetTitle className="border-b p-5 text-lg">فیلتر محصولات</SheetTitle>
          <SheetDescription className="sr-only">برند، مدل، سال و دسته‌بندی را انتخاب کنید</SheetDescription>
          <div className="overflow-y-auto p-5">{filters}</div>
          <div className="border-t p-4">
            <Button className="w-full" size="lg" onClick={() => setMobileOpen(false)}>نمایش {toFa(results.length)} محصول</Button>
          </div>
        </SheetContent>
      </Sheet>

      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3">
          <Button variant="outline" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <SlidersHorizontal />
            فیلترها
            {chips.length > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] text-white">{toFa(chips.length)}</span>}
          </Button>
          <p className="text-sm text-neutral-600">
            <span className="font-extrabold text-neutral-950">{toFa(results.length)}</span> محصول
          </p>
          <div className="mr-auto flex items-center gap-2">
            <ArrowDownWideNarrow className="hidden size-4 text-neutral-400 sm:block" />
            <span className="hidden text-sm text-neutral-500 sm:inline">مرتب‌سازی:</span>
            <div className="hidden gap-1 xl:flex">
              {SORT_OPTIONS.map((o) => (
                <button key={o.value} onClick={() => update({ sort: o.value === "popular" ? null : o.value })} className={cn("cursor-pointer rounded-lg px-3 py-1.5 text-sm transition", sort === o.value ? "bg-neutral-950 font-semibold text-white" : "text-neutral-600 hover:bg-neutral-100")}>
                  {o.label}
                </button>
              ))}
            </div>
            <Select value={sort} onValueChange={(v) => update({ sort: v === "popular" ? null : v })}>
              <SelectTrigger className="h-10 w-40 xl:hidden"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <button key={c.label} onClick={() => update(c.clear)} className="group flex cursor-pointer items-center gap-1.5 rounded-full bg-neutral-950 py-1.5 pr-3.5 pl-2 text-xs font-semibold text-white transition hover:bg-primary">
                {c.label}
                <X className="size-3.5 opacity-60 group-hover:opacity-100" />
              </button>
            ))}
            <button onClick={clearAll} className="cursor-pointer px-2 text-xs font-semibold text-primary hover:underline">حذف همه فیلترها</button>
          </div>
        )}

        {results.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-16 text-center">
            <span className="grid size-16 place-items-center rounded-2xl bg-white text-neutral-400 shadow-sm"><PackageSearch className="size-8" /></span>
            <h3 className="mt-5 text-lg font-bold">محصولی با این مشخصات پیدا نشد</h3>
            <p className="mt-2 max-w-md text-sm text-neutral-500">فیلترها را تغییر دهید یا کد فنی قطعه را برای کارشناسان ما بفرستید تا از انبار مرکزی استعلام شود.</p>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" onClick={clearAll}>حذف فیلترها</Button>
              <Button asChild><Link href="/contact">استعلام قطعه</Link></Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3">
              {results.slice(0, limit).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
            {results.length > limit && (
              <div className="mt-8 flex flex-col items-center gap-3">
                <p className="text-xs text-neutral-500">نمایش {toFa(Math.min(limit, results.length))} از {toFa(results.length)} محصول</p>
                <div className="h-1 w-48 overflow-hidden rounded-full bg-neutral-200"><div className="h-full bg-primary" style={{ width: `${(limit / results.length) * 100}%` }} /></div>
                <Button variant="dark" size="lg" onClick={() => setLimit((l) => l + PAGE)}>نمایش محصولات بیشتر</Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FilterPanel({
  q, brand, model, year, cats, inStock, price, fixedBrand, fixedCategory, showSearch, update,
}: {
  q: string; brand: string; model: string; year: string; cats: string[]; inStock: boolean; price: string;
  fixedBrand?: BrandId; fixedCategory?: string; showSearch: boolean;
  update: (p: Record<string, string | null>) => void;
}) {
  const [text, setText] = useState(q);
  const models = brand ? modelsOf(brand as BrandId) : MODELS;
  const count = (fn: (p: (typeof PRODUCTS)[number]) => boolean) => PRODUCTS.filter((p) => (!brand || p.brand === brand) && fn(p)).length;

  return (
    <div className="space-y-6">
      {showSearch && (
        <form onSubmit={(e) => { e.preventDefault(); update({ q: text.trim() || null }); }} className="relative">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="نام قطعه، کد فنی، OEM…" className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 pr-10 pl-3 text-sm outline-none focus:border-neutral-950 focus:bg-white" />
          <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-neutral-400" />
        </form>
      )}

      {!fixedBrand && (
        <Group title="برند خودرو">
          <div className="grid grid-cols-3 gap-1.5">
            {[{ id: "", nameFa: "همه" }, ...BRANDS].map((b) => (
              <button key={b.id} onClick={() => update({ brand: b.id || null, model: null, year: null })} className={cn("cursor-pointer rounded-xl border py-2 text-sm font-semibold transition", brand === b.id ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 hover:border-neutral-400")}>
                {b.nameFa}
              </button>
            ))}
          </div>
        </Group>
      )}

      <Group title="مدل خودرو">
        <div className="max-h-64 space-y-0.5 overflow-y-auto pl-1">
          {models.map((m) => {
            const n = PRODUCTS.filter((p) => p.fitments.some((f) => f.model === m.id)).length;
            return (
              <button key={m.id} onClick={() => update({ model: model === m.id ? null : m.id, year: null, ...(fixedBrand ? {} : { brand: m.brand }) })} className={cn("flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-sm transition", model === m.id ? "bg-red-50 font-bold text-primary" : "hover:bg-neutral-50")}>
                <span className="flex items-center gap-2">
                  <span className={cn("grid size-4 place-items-center rounded-full border-2", model === m.id ? "border-primary" : "border-neutral-300")}>{model === m.id && <span className="size-1.5 rounded-full bg-primary" />}</span>
                  {m.nameFa}
                  <span className="text-[11px] text-neutral-400" dir="ltr">{m.nameEn}</span>
                </span>
                <span className="text-[11px] text-neutral-400">{toFa(n)}</span>
              </button>
            );
          })}
        </div>
      </Group>

      {model && (
        <Group title="سال ساخت">
          <Select value={year || "all"} onValueChange={(v) => update({ year: v === "all" ? null : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه سال‌ها</SelectItem>
              {yearsOf(model).map((y) => <SelectItem key={y} value={String(y)}>{toFa(y)}</SelectItem>)}
            </SelectContent>
          </Select>
        </Group>
      )}

      {!fixedCategory && (
        <Group title="دسته‌بندی قطعه">
          <div className="max-h-72 space-y-0.5 overflow-y-auto pl-1">
            {CATEGORIES.map((c) => {
              const checked = cats.includes(c.id);
              const n = count((p) => p.category === c.id);
              return (
                <label key={c.id} className={cn("flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-sm transition hover:bg-neutral-50", n === 0 && "opacity-40")}>
                  <span className="flex items-center gap-2.5">
                    <input type="checkbox" checked={checked} onChange={() => update({ cat: (checked ? cats.filter((x) => x !== c.id) : [...cats, c.id]).join(",") || null })} className="size-4 cursor-pointer accent-[#e10600]" />
                    {c.nameFa}
                  </span>
                  <span className="text-[11px] text-neutral-400">{toFa(n)}</span>
                </label>
              );
            })}
          </div>
        </Group>
      )}

      <Group title="محدوده قیمت (تومان)">
        <div className="grid grid-cols-2 gap-1.5">
          {PRICE_RANGES.map((r) => (
            <button key={r.id} onClick={() => update({ price: price === r.id ? null : r.id })} className={cn("cursor-pointer rounded-xl border px-2 py-2 text-xs font-semibold transition", price === r.id ? "border-primary bg-red-50 text-primary" : "border-neutral-200 hover:border-neutral-400")}>
              {r.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-neutral-400">ارزان‌ترین: {formatPrice(Math.min(...PRODUCTS.map((p) => p.price)))} تومان</p>
      </Group>

      <label className="flex cursor-pointer items-center justify-between rounded-xl bg-neutral-50 p-3 text-sm font-semibold">
        فقط کالاهای موجود
        <span className="relative">
          <input type="checkbox" className="peer sr-only" checked={inStock} onChange={() => update({ stock: inStock ? null : "1" })} />
          <span className="block h-6 w-11 rounded-full bg-neutral-300 transition peer-checked:bg-primary" />
          <span className="absolute top-1 right-1 size-4 rounded-full bg-white shadow transition peer-checked:-translate-x-5" />
        </span>
      </label>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-3 text-sm font-extrabold text-neutral-950">{title}</h4>
      {children}
    </div>
  );
}
