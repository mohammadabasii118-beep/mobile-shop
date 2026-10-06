"use client";
import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { SiteImage } from "@/components/site-image";
import { Thumb } from "@/components/product-detail";
import { cn } from "@/lib/utils";
import type { CardProduct } from "@/lib/types";

export interface GalleryItem { id: string; type: "IMAGE" | "VIDEO"; url: string; alt: string | null; caption: string | null; width: number | null; height: number | null }

/**
 * Product media. The main frame keeps the existing square, so switching never shifts the layout (no CLS). Primary image first,
 * only the first image is eager; thumbnails are lazy. A video is only created when chosen: controls, no autoplay, metadata preload.
 */
export function ProductGallery({ items, fallback, brandName, hot, hotBadge }: { items: GalleryItem[]; fallback: Pick<CardProduct, "hue" | "kind" | "img" | "name">; brandName: string; hot: React.ReactNode; hotBadge: boolean }) {
  const [i, setI] = useState(0);
  // A chosen variant with its own image switches the gallery to that image (null = back to the product's first image).
  useEffect(() => {
    const on = (e: Event) => { const url = (e as CustomEvent<string | null>).detail; const at = url ? items.findIndex((m) => m.type === "IMAGE" && m.url === url) : 0; setI(at >= 0 ? at : 0); };
    window.addEventListener("caseline:variant-image", on);
    return () => window.removeEventListener("caseline:variant-image", on);
  }, [items]);
  const cur = items[i];
  const poster = items.find((m) => m.type === "IMAGE")?.url;
  return (
    <div className="w-full lg:sticky lg:top-24" data-testid="gallery">
      <div className="relative aspect-square w-full sm:aspect-[5/6]">
        {!cur || cur.type === "IMAGE" ? (
          cur ? (
            <span key={cur.id} className="relative block size-full overflow-hidden rounded-[10px] bg-surface-2">
              <SiteImage src={cur.url} alt={cur.alt || fallback.name} priority={i === 0} sizes="(min-width: 768px) 384px, 90vw" />
            </span>
          ) : <Thumb p={fallback} priority className="size-full rounded-[10px]" />
        ) : (
          <video key={cur.id} data-testid="gallery-video" controls preload="metadata" playsInline poster={poster} className="size-full rounded-[10px] bg-black object-contain" aria-label={cur.alt || cur.caption || `ویدیو ${fallback.name}`}>
            <source src={cur.url} type={cur.url.endsWith(".webm") ? "video/webm" : "video/mp4"} />
          </video>
        )}
        {(!cur || cur.type === "IMAGE") && brandName && <span dir="ltr" className="pointer-events-none absolute bottom-3 start-3 rounded-[6px] bg-background/85 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">{brandName}</span>}
        {hotBadge && (!cur || cur.type === "IMAGE") && <div className="absolute start-3 top-3">{hot}</div>}
      </div>
      {items.length > 1 && (
        <ul className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="تصاویر و ویدیوهای محصول" data-testid="gallery-thumbs">
          {items.map((m, idx) => (
            <li key={m.id} className="shrink-0">
              <button type="button" onClick={() => setI(idx)} aria-label={m.type === "VIDEO" ? "پخش ویدیو" : `تصویر ${(idx + 1).toLocaleString("fa-IR")}`} aria-current={idx === i} data-testid="gallery-thumb"
                className={cn("relative block size-[68px] cursor-pointer overflow-hidden rounded-[8px] border bg-surface-2 transition-colors", idx === i ? "border-foreground" : "border-transparent hover:border-border-strong")}>
                {m.type === "IMAGE" ? <SiteImage src={m.url} alt={m.alt || fallback.name} sizes="64px" /> : (
                  <>{poster && <SiteImage src={poster} alt="" sizes="64px" />}<span className="absolute inset-0 grid place-items-center bg-black/40 text-white"><Play className="size-5 fill-current" /></span></>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
