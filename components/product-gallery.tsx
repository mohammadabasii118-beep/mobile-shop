"use client";
import { useState } from "react";
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
  const cur = items[i];
  const poster = items.find((m) => m.type === "IMAGE")?.url;
  return (
    <div className="mx-auto w-full max-w-sm md:order-2" data-testid="gallery">
      <div className="relative aspect-square w-full">
        {!cur || cur.type === "IMAGE" ? (
          cur ? (
            <span key={cur.id} className="relative block size-full overflow-hidden rounded-[32px] bg-surface-2">
              <SiteImage src={cur.url} alt={cur.alt || fallback.name} priority={i === 0} sizes="(min-width: 768px) 384px, 90vw" />
            </span>
          ) : <Thumb p={fallback} priority className="size-full rounded-[32px]" />
        ) : (
          <video key={cur.id} data-testid="gallery-video" controls preload="metadata" playsInline poster={poster} className="size-full rounded-[32px] bg-black object-contain" aria-label={cur.alt || cur.caption || `ویدیو ${fallback.name}`}>
            <source src={cur.url} type={cur.url.endsWith(".webm") ? "video/webm" : "video/mp4"} />
          </video>
        )}
        {(!cur || cur.type === "IMAGE") && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 rounded-b-[32px] bg-black/80 py-4 text-white">
            <span dir="ltr" className="text-2xl font-black tracking-wide">{brandName}</span>
            <span dir="ltr" className="text-[10px] font-bold tracking-[0.3em] text-accent">Caseline.ir</span>
          </div>
        )}
        {hotBadge && (!cur || cur.type === "IMAGE") && <div className="absolute end-3 top-3">{hot}</div>}
      </div>
      {items.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="تصاویر و ویدیوهای محصول" data-testid="gallery-thumbs">
          {items.map((m, idx) => (
            <li key={m.id} className="shrink-0">
              <button type="button" onClick={() => setI(idx)} aria-label={m.type === "VIDEO" ? "پخش ویدیو" : `تصویر ${(idx + 1).toLocaleString("fa-IR")}`} aria-current={idx === i} data-testid="gallery-thumb"
                className={cn("relative block size-16 cursor-pointer overflow-hidden rounded-lg border-2 bg-surface-2", idx === i ? "border-primary" : "border-transparent hover:border-border")}>
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
