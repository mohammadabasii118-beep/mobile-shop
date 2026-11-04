import { cn } from "@/lib/utils";

/** Studio-lit product image frame. Images are vector renders from /public/parts. */
export function PartImage({
  src,
  alt,
  className,
  imgClassName,
  priority,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-studio", className)}>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/[0.03] to-transparent" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        className={cn("relative size-full object-contain p-[8%] transition-transform duration-500 ease-out", imgClassName)}
      />
    </div>
  );
}
