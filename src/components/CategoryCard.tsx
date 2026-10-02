import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import type { Category, ArtKind } from '@/types';
import { ProductArt } from './ProductArt';

const artOf: Record<string, ArtKind> = { cases: 'case', 'screen-protectors': 'glass', chargers: 'charger', cables: 'cable', 'power-banks': 'powerbank', accessories: 'holder' };

export function CategoryCard({ cat, index }: { cat: Category; index: number }) {
  return (
    <motion.div whileHover={{ scale: 1.025 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}>
      <Link to={`/category/${cat.slug}`} className="group card relative flex h-72 flex-col justify-between overflow-hidden p-6 transition-colors duration-500 hover:border-white/25"
        style={{ ['--hue' as string]: cat.hue }}>
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ background: `radial-gradient(circle at 20% 80%, ${cat.hue}33, transparent 60%)` }} />
        <span className="relative text-6xl font-black leading-none text-white/10">{String(index + 1).padStart(2, '0').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d])}</span>
        <ProductArt kind={artOf[cat.slug]} color={cat.hue} className="absolute -bottom-3 left-0 h-52 w-52 transition-transform duration-700 group-hover:-translate-y-3 group-hover:rotate-6 group-hover:scale-110" />
        <div className="relative">
          <h3 className="text-xl font-black text-white">{cat.name}</h3>
          <p className="mt-1 max-w-[55%] text-xs leading-6 text-mist/60">{cat.description}</p>
          <ArrowLeft size={20} className="mt-3 text-white transition-transform duration-300 group-hover:-translate-x-2" />
        </div>
      </Link>
    </motion.div>
  );
}
