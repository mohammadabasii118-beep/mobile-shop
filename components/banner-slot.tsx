import { getBanners } from "@/lib/queries";

/** Renders every active, in-schedule banner assigned to a placement (managed in the admin panel). */
export async function BannerSlot({ placement, className }: { placement: string; className?: string }) {
  const banners = await getBanners(placement);
  if (!banners.length) return null;
  return (
    <div className={className ?? "mb-4 space-y-3"} data-banner-slot={placement}>
      {banners.map((b) => (
        <a key={b.id} href={b.buttonLink ?? "#"} className="block overflow-hidden rounded-xl border border-border bg-primary/10 text-center transition-shadow hover:shadow-md">
          {(b.desktopImage || b.mobileImage) && (
            <picture>
              {b.mobileImage && <source media="(max-width: 640px)" srcSet={b.mobileImage} />}
              
              <img src={b.desktopImage || b.mobileImage || ""} alt={b.title} loading="lazy" decoding="async" className="max-h-48 w-full object-cover" />
            </picture>
          )}
          <div className="p-3">
            <b className="block text-sm">{b.title}</b>
            {b.subtitle && <span className="block text-xs text-muted">{b.subtitle}</span>}
            {b.description && <span className="mt-1 block text-xs leading-6 text-muted">{b.description}</span>}
            {b.buttonText && <span className="mt-2 inline-block rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-fg">{b.buttonText}</span>}
          </div>
        </a>
      ))}
    </div>
  );
}
