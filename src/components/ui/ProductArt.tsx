import {
  Smartphone,
  ShieldCheck,
  Zap,
  Cable,
  BatteryCharging,
  Headphones,
  Speaker,
  Watch,
  Magnet,
  Package,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  cases: Smartphone,
  glass: ShieldCheck,
  chargers: Zap,
  cables: Cable,
  powerbanks: BatteryCharging,
  headphones: Headphones,
  speakers: Speaker,
  holders: Magnet,
  smartwatch: Watch,
  accessories: Package,
};

/**
 * Stylized placeholder art for a product — a glossy metallic panel tinted by
 * the product hue with a large category glyph. This is intentionally an
 * abstract visual, NOT a photograph of a real product.
 */
export default function ProductArt({
  hue,
  categorySlug,
  className = "",
}: {
  hue: number;
  categorySlug: string;
  className?: string;
}) {
  const Icon = ICONS[categorySlug] ?? Package;
  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{
        background: `radial-gradient(120% 120% at 30% 20%, hsl(${hue} 30% 22%) 0%, hsl(${hue} 25% 10%) 45%, #07070a 100%)`,
      }}
      aria-hidden
    >
      {/* soft glow */}
      <div
        className="absolute -right-10 -top-10 h-48 w-48 rounded-full blur-3xl"
        style={{ background: `hsl(${hue} 60% 55% / 0.25)` }}
      />
      {/* metallic sheen sweep */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.06] to-transparent" />
      {/* glyph */}
      <div className="absolute inset-0 grid place-items-center">
        <Icon
          className="h-1/2 w-1/2 opacity-90"
          strokeWidth={1}
          style={{ color: `hsl(${hue} 25% 82%)` }}
        />
      </div>
      {/* bottom reflection */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent" />
    </div>
  );
}
