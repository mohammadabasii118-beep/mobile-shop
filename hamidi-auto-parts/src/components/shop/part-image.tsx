import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Studio-lit product image. Uses next/image so every device receives an
 * AVIF/WebP of exactly the width it needs; width/height reserve space (CLS = 0).
 */
export function PartImage({
  src,
  alt,
  sizes,
  className,
  imgClassName,
  preload,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  imgClassName?: string;
  /** only for the LCP image of a page */
  preload?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-studio", className)}>
      <Image
        src={src}
        alt={alt}
        width={1200}
        height={1200}
        sizes={sizes}
        preload={preload}
        fetchPriority={preload ? "high" : undefined}
        draggable={false}
        className={cn("relative size-full object-contain p-[8%] transition-transform duration-500 ease-out", imgClassName)}
      />
    </div>
  );
}
