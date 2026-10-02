import type { Tile } from '../data';

export default function TileArt({ tile, className, style }: { tile: Tile; className?: string; style?: React.CSSProperties }) {
  const Icon = tile.icon;
  return (
    <div
      className={`relative overflow-hidden flex flex-col items-center justify-center gap-3 ${className ?? ''}`}
      style={{ background: `linear-gradient(135deg, ${tile.from} 0%, ${tile.to} 100%)`, ...style }}
    >
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
      <Icon className="text-white/90 relative" size={64} strokeWidth={1.2} />
      <span className="relative text-white/90 font-medium uppercase tracking-widest text-sm">{tile.label}</span>
    </div>
  );
}
