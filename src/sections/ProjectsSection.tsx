import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import FadeIn from '../components/FadeIn';
import LiveProjectButton from '../components/LiveProjectButton';
import TileArt from '../components/TileArt';
import { products } from '../data';
import type { Product } from '../data';

const radius = 'rounded-[40px] sm:rounded-[50px] md:rounded-[60px]';

function Card({ product, index, total, progress }: { product: Product; index: number; total: number; progress: MotionValue<number> }) {
  const targetScale = 1 - (total - 1 - index) * 0.03;
  const range: [number, number] = [index / total, 1];
  const scale = useTransform(progress, range, [1, targetScale]);

  return (
    <div className="h-[85vh]">
      <div className="sticky top-24 md:top-32">
        <motion.div
          className={`${radius} border-2 border-[#D7E2EA] p-4 sm:p-6 md:p-8 origin-top`}
          style={{ background: '#0C0C0C', scale, top: `${index * 28}px`, position: 'relative' }}
        >
          <div className="flex items-center justify-between gap-4 mb-4 sm:mb-6">
            <div className="flex items-center gap-4 sm:gap-8 min-w-0">
              <span className="hero-heading font-black leading-none" style={{ fontSize: 'clamp(3rem, 10vw, 140px)' }}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <p className="text-[#D7E2EA] font-light uppercase tracking-wider" style={{ fontSize: 'clamp(0.7rem, 1.2vw, 1rem)', opacity: 0.6 }}>
                  {product.category} · {product.price}
                </p>
                <h3 className="text-[#D7E2EA] font-medium uppercase" style={{ fontSize: 'clamp(1rem, 2.2vw, 2.1rem)' }}>
                  {product.name}
                </h3>
              </div>
            </div>
            <div className="hidden sm:block">
              <LiveProjectButton label="Buy Now" />
            </div>
          </div>
          <div className="flex gap-3 sm:gap-4">
            <div className="flex flex-col gap-3 sm:gap-4" style={{ width: '40%' }}>
              <TileArt tile={product.tiles[0]} className={radius} style={{ height: 'clamp(130px, 16vw, 230px)' }} />
              <TileArt tile={product.tiles[1]} className={radius} style={{ height: 'clamp(160px, 22vw, 340px)' }} />
            </div>
            <TileArt tile={product.tiles[2]} className={radius} style={{ width: '60%' }} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function ProjectsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  return (
    <section id="products" className="relative z-10 -mt-10 sm:-mt-12 md:-mt-14 rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] px-5 sm:px-8 md:px-10 pt-20 sm:pt-24 md:pt-32 pb-20" style={{ background: '#0C0C0C' }}>
      <FadeIn>
        <h2 className="hero-heading font-black uppercase leading-none tracking-tight text-center mb-16 sm:mb-20 md:mb-28" style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}>
          Products
        </h2>
      </FadeIn>
      <div ref={ref} id="contact">
        {products.map((p, i) => (
          <Card key={p.name} product={p} index={i} total={products.length} progress={scrollYProgress} />
        ))}
      </div>
    </section>
  );
}
