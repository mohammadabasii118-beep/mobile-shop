import Image from "next/image";
import { cn } from "@/lib/utils";

const VIEWS = [
  { label: "نمای اصلی", cls: "" },
  { label: "نمای جانبی", cls: "-scale-x-100 rotate-6" },
  { label: "نمای جزئیات", cls: "scale-[1.6] origin-[60%_40%]" },
  { label: "نمای بالا", cls: "rotate-[-14deg] scale-90" },
];

/**
 * Server-rendered gallery. View switching uses radio inputs + CSS (:has),
 * hover-zoom is pure CSS – zero client JavaScript, the main image is the
 * preloaded LCP element.
 */
export function ProductGallery({ src, alt, badges }: { src: string; alt: string; badges?: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start">
      <fieldset className="no-scrollbar flex gap-2 overflow-x-auto sm:flex-col">
        <legend className="sr-only">نماهای تصویر محصول</legend>
        {VIEWS.map((v, i) => (
          <label key={v.label} className="relative size-20 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 border-transparent bg-studio transition hover:border-neutral-300 has-[:checked]:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary">
            <input type="radio" name="gallery-view" value={i} defaultChecked={i === 0} className="sr-only" aria-label={v.label} />
            <Image src={src} alt="" width={160} height={160} sizes="80px" className={cn("size-full object-contain p-2", v.cls)} />
          </label>
        ))}
      </fieldset>
      <figure className="group/zoom relative aspect-square w-full flex-1 overflow-hidden rounded-3xl border border-neutral-200 bg-studio">
        {VIEWS.map((v, i) => (
          <div
            key={v.label}
            className={cn(
              "absolute inset-0 transition-[opacity,transform] duration-300 group-hover/zoom:scale-125",
              i === 0 ? "opacity-100" : "opacity-0",
              // show the view whose radio is checked (gallery-view inputs live in the sibling fieldset)
              i === 0 && "[:has(input[name=gallery-view][value='0']:not(:checked))_&]:opacity-0",
              i === 1 && "[:has(input[name=gallery-view][value='1']:checked)_&]:opacity-100",
              i === 2 && "[:has(input[name=gallery-view][value='2']:checked)_&]:opacity-100",
              i === 3 && "[:has(input[name=gallery-view][value='3']:checked)_&]:opacity-100",
            )}
          >
            {i === 0 ? (
              <Image src={src} alt={alt} width={1200} height={1200} sizes="(min-width:1280px) 520px, (min-width:1024px) 45vw, 100vw" preload fetchPriority="high" className="size-full object-contain p-[10%]" />
            ) : (
              <Image src={src} alt="" width={1200} height={1200} sizes="(min-width:1280px) 520px, (min-width:1024px) 45vw, 100vw" className={cn("size-full object-contain p-[10%]", v.cls)} />
            )}
          </div>
        ))}
        <div className="absolute top-4 right-4 flex flex-col items-start gap-1.5">{badges}</div>
        <figcaption className="sr-only">{alt}</figcaption>
      </figure>
    </div>
  );
}
