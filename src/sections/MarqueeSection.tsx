import { useEffect, useRef, useState } from 'react';
import { marqueeTiles } from '../data';
import TileArt from '../components/TileArt';

export default function MarqueeSection() {
  const ref = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setOffset((window.scrollY - top + window.innerHeight) * 0.3);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const row1 = marqueeTiles.slice(0, 11);
  const row2 = marqueeTiles.slice(11);
  const triple = <T,>(a: T[]) => [...a, ...a, ...a];

  const renderRow = (tiles: typeof marqueeTiles, x: number) => (
    <div className="flex gap-3 w-max" dir="ltr" style={{ transform: `translateX(${x}px)`, willChange: 'transform' }}>
      {triple(tiles).map((t, i) => (
        <TileArt key={i} tile={t} className="rounded-2xl shrink-0" style={{ width: 420, height: 270 }} />
      ))}
    </div>
  );

  return (
    <section ref={ref} id="categories" className="pt-24 sm:pt-32 md:pt-40 pb-10 flex flex-col gap-3" dir="ltr" style={{ background: '#0C0C0C', overflow: 'hidden' }}>
      {renderRow(row1, offset - 200 - row1.length * 432)}
      {renderRow(row2, -(offset - 200) - row2.length * 432)}
    </section>
  );
}
