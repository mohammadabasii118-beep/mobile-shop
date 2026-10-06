import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Photo that fills its (relatively positioned) parent. Uploaded images under /media are resized and served as
 * AVIF/WebP at the needed width with lazy loading; other URLs are shown as-is. `priority` is for the LCP image only.
 */
export function SiteImage({ src, alt, sizes, priority, className }: { src: string; alt: string; sizes: string; priority?: boolean; className?: string }) {
  const optimized = src.startsWith("/media/");
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} unoptimized={!optimized} className={cn("object-cover", className)} />;
}
