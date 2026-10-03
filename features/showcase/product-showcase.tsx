"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Minus, MoveHorizontal, Pause, Play, Plus, ShoppingBag } from "lucide-react";
import { products } from "@/data/mock";
import { caseColors, materials, patterns, phones, type MaterialId, type PatternId, type PhoneId } from "@/data/configurator";
import type { AnglePreset, ViewerApi } from "@/3d/viewer";
import { CanvasShell } from "@/components/product/canvas-shell";
import { ProductArt } from "@/components/product/product-art";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { SectionHeader } from "@/components/ui/section-header";
import { Swatches } from "@/features/catalog/swatches";
import { useCart } from "@/features/cart/cart-context";
import { buildLine } from "@/features/cart/build-line";
import { useCanUse3D } from "@/hooks/use-can-use-3d";
import { configuratorPrice } from "@/lib/pricing";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const Viewer3D = dynamic(() => import("@/3d/viewer"), { ssr: false });

const SHOWCASE_IDS = ["p-aura-17pro", "p-halo-25", "p-pulse-anc", "p-slate-10k"];
const showcaseProducts = SHOWCASE_IDS.map((id) => products.find((p) => p.id === id)!);
const ANGLES: { id: AnglePreset; label: string }[] = [
  { id: "iso", label: "۳/۴" },
  { id: "front", label: "روبه‌رو" },
  { id: "side", label: "کنار" },
  { id: "back", label: "پشت" },
  { id: "detail", label: "جزئیات" },
];

function Chip({ active, children, className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      {...p}
      aria-pressed={active}
      className={cn(
        "min-h-11 rounded-full px-4 text-sm font-semibold transition-colors",
        active ? "bg-primary text-primary-fg" : "bg-secondary text-fg hover:bg-line",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ProductShowcase() {
  const [tab, setTab] = useState<"view" | "build">("build");
  const [pid, setPid] = useState(SHOWCASE_IDS[0]);
  const [colorId, setColorId] = useState<Record<string, string>>({});
  const [phone, setPhone] = useState<PhoneId>("iphone-17-pro");
  const [material, setMaterial] = useState<MaterialId>("silicone");
  const [pattern, setPattern] = useState<PatternId>("plain");
  const [buildColor, setBuildColor] = useState("midnight");
  const [angle, setAngle] = useState<AnglePreset>("iso");
  const [zoom, setZoom] = useState(1);
  const [spin, setSpin] = useState(true);
  const api = useRef<ViewerApi | null>(null);
  const cap = useCanUse3D();
  const { add } = useCart();

  const product = showcaseProducts.find((p) => p.id === pid)!;
  const viewColor = product.colors.find((c) => c.id === colorId[pid]) ?? product.colors[0];
  const bc = caseColors.find((c) => c.id === buildColor)!;
  const buildPrice = configuratorPrice(phone, material, pattern);
  const phoneSpec = phones.find((p) => p.id === phone)!;

  const building = tab === "build";
  const kind = building ? "case" : product.kind;
  const color = building ? bc.hex : viewColor.hex;
  const stageLabel = building ? `قاب سفارشی ${phoneSpec.name}، رنگ ${bc.name}` : `${product.name}، رنگ ${viewColor.name}`;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); api.current?.rotate(0.3); }
    else if (e.key === "ArrowRight") { e.preventDefault(); api.current?.rotate(-0.3); }
    else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(2, +(z + 0.25).toFixed(2)));
    else if (e.key === "-") setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)));
  };

  const addCustom = () =>
    add({
      key: `custom:${phone}:${material}:${pattern}:${buildColor}`,
      productId: "custom-case",
      name: `قاب سفارشی ${phoneSpec.name}`,
      brand: "ولتا",
      kind: "case",
      colorName: bc.name,
      colorHex: bc.hex,
      unitPrice: buildPrice,
      note: `${materials.find((m) => m.id === material)!.name} · ${patterns.find((x) => x.id === pattern)!.name}`,
    });

  return (
    <section id="showcase" className="surface-dark bg-bg py-section text-fg">
      <div className="container-x">
        <SectionHeader eyebrow="تجربهٔ ۳D" title="قبل از خرید، دقیق ببینش." description="بچرخان، نزدیک کن، رنگ و متریال را عوض کن. نتیجه همان‌جا و زنده دیده می‌شود." />

        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          {/* کنترل‌ها — سمت start (راست در RTL) */}
          <div className="order-2 flex flex-col gap-7 lg:order-1 lg:col-span-5">
            <div role="tablist" aria-label="حالت نمایش" className="inline-flex self-start rounded-full bg-secondary p-1">
              {([["build", "طراحی قاب"], ["view", "نمایش محصولات"]] as const).map(([id, l]) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setAngle("iso"); }} className={cn("min-h-11 rounded-full px-5 text-sm font-semibold transition-colors", tab === id ? "bg-primary text-primary-fg" : "text-muted hover:text-fg")}>
                  {l}
                </button>
              ))}
            </div>

            {building ? (
              <>
                <fieldset>
                  <legend className="t-caption mb-3 text-muted">۱ · مدل گوشی</legend>
                  <div className="flex flex-wrap gap-2">
                    {phones.map((p) => <Chip key={p.id} active={phone === p.id} onClick={() => setPhone(p.id)}><bdi>{p.name}</bdi></Chip>)}
                  </div>
                </fieldset>
                <div>
                  <p className="t-caption mb-3 text-muted">۲ · رنگ — <b className="text-fg">{bc.name}</b></p>
                  <Swatches colors={caseColors} value={buildColor} onChange={setBuildColor} size="md" label="رنگ قاب" />
                </div>
                <fieldset>
                  <legend className="t-caption mb-3 text-muted">۳ · متریال</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {materials.map((m) => (
                      <button key={m.id} aria-pressed={material === m.id} onClick={() => setMaterial(m.id)} className={cn("rounded-md p-3 text-start transition-shadow", material === m.id ? "bg-secondary shadow-[inset_0_0_0_2px_var(--accent)]" : "bg-secondary/60 shadow-hairline hover:bg-secondary")}>
                        <span className="block text-sm font-semibold">{m.name}</span>
                        <span className="t-caption text-muted">{m.hint}{m.surcharge > 0 && <> · <span className="num">+{formatNumber(m.surcharge / 1000)}هزار</span></>}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="t-caption mb-3 text-muted">۴ · طرح</legend>
                  <div className="flex flex-wrap gap-2">
                    {patterns.map((t) => <Chip key={t.id} active={pattern === t.id} onClick={() => setPattern(t.id)}>{t.name}</Chip>)}
                  </div>
                </fieldset>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
                  <div>
                    <p className="t-caption text-muted">قیمت نهایی</p>
                    <p className="price text-2xl md:text-3xl"><AnimatedNumber value={buildPrice} /> <span className="text-[0.55em] font-medium text-muted">تومان</span></p>
                  </div>
                  <Button variant="accent" size="lg" onClick={addCustom}><ShoppingBag /> افزودن به سبد</Button>
                </div>
              </>
            ) : (
              <>
                <div role="radiogroup" aria-label="محصول" className="grid grid-cols-2 gap-2">
                  {showcaseProducts.map((p) => (
                    <button key={p.id} role="radio" aria-checked={pid === p.id} onClick={() => { setPid(p.id); setAngle("iso"); }} className={cn("flex items-center gap-3 rounded-md p-2 pe-3 text-start transition-shadow", pid === p.id ? "bg-secondary shadow-[inset_0_0_0_2px_var(--accent)]" : "bg-secondary/60 shadow-hairline hover:bg-secondary")}>
                      <span className="grid size-14 shrink-0 place-items-center rounded-sm bg-stage"><ProductArt kind={p.kind} color={(p.colors.find((c) => c.id === colorId[p.id]) ?? p.colors[0]).hex} className="size-12" label="" /></span>
                      <span className="line-clamp-2 text-sm font-semibold leading-6">{p.name}</span>
                    </button>
                  ))}
                </div>
                <div>
                  <p className="t-caption mb-3 text-muted">رنگ — <b className="text-fg">{viewColor.name}</b></p>
                  <Swatches colors={product.colors} value={viewColor.id} onChange={(id) => setColorId((s) => ({ ...s, [pid]: id }))} size="md" label="رنگ محصول" />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
                  <Price value={product.price} oldValue={product.oldPrice} size="lg" />
                  <Button variant="accent" size="lg" onClick={() => add(buildLine(product, viewColor))}><ShoppingBag /> افزودن به سبد</Button>
                </div>
              </>
            )}
          </div>

          {/* Viewer — سمت end (چپ در RTL) */}
          <div className="order-1 lg:order-2 lg:col-span-7">
            <div
              tabIndex={0}
              onKeyDown={onKey}
              aria-describedby="viewer-help"
              className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-stage outline-offset-4 sm:aspect-square lg:aspect-auto lg:h-[min(720px,80dvh)]"
            >
              <div className="glow pointer-events-none absolute inset-0 opacity-60" aria-hidden />
              <CanvasShell
                className="size-full"
                label={stageLabel}
                fallback={
                  <div className="absolute inset-0 grid place-items-center">
                    <ProductArt kind={kind} color={color} className="size-[70%]" label={stageLabel} />
                  </div>
                }
              >
                {(c) => (
                  <Viewer3D
                    kind={kind}
                    color={color}
                    phone={phone}
                    material={building ? material : "silicone"}
                    pattern={building ? pattern : "plain"}
                    angle={angle}
                    zoom={zoom}
                    autoRotate={spin}
                    quality={c.quality}
                    reducedMotion={c.reducedMotion}
                    apiRef={api}
                  />
                )}
              </CanvasShell>

              {cap.status === "yes" ? (
                <>
                  <div className="absolute inset-x-3 bottom-3 flex justify-center">
                    <div role="group" aria-label="زاویهٔ دید" className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full bg-bg/70 p-1 backdrop-blur-sm">
                      {ANGLES.map((a) => (
                        <button key={a.id} aria-pressed={angle === a.id} onClick={() => { setAngle(a.id); setSpin(false); }} className={cn("min-h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-colors", angle === a.id ? "bg-primary text-primary-fg" : "text-muted hover:text-fg")}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="absolute end-3 top-3 flex flex-col gap-2">
                    <Button variant="secondary" size="icon" onClick={() => setZoom((z) => Math.min(2, +(z + 0.25).toFixed(2)))} aria-label="نزدیک‌تر" disabled={zoom >= 2}><Plus /></Button>
                    <Button variant="secondary" size="icon" onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))} aria-label="دورتر" disabled={zoom <= 0.75}><Minus /></Button>
                    <Button variant="secondary" size="icon" onClick={() => setSpin((s) => !s)} aria-label={spin ? "توقف چرخش خودکار" : "چرخش خودکار"} aria-pressed={spin}>{spin ? <Pause /> : <Play />}</Button>
                  </div>
                  <p className="t-caption pointer-events-none absolute start-4 top-4 flex items-center gap-1.5 rounded-full bg-bg/70 px-3 py-1 text-muted backdrop-blur-sm">
                    <MoveHorizontal className="size-3.5" aria-hidden /> بکش تا بچرخد
                  </p>
                </>
              ) : cap.status === "no" ? (
                <p className="t-caption absolute inset-x-0 bottom-4 text-center text-muted">نمای ثابت — ۳D روی این دستگاه غیرفعال است.</p>
              ) : null}
            </div>
            <p id="viewer-help" className="sr-only">با کلیدهای چپ و راست محصول را بچرخانید و با مثبت و منفی بزرگ‌نمایی کنید.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
