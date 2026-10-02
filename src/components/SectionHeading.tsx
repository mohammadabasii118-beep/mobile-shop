import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AnimatedText } from './AnimatedText';

export function SectionHeading({ eyebrow, title, link, to }: { eyebrow?: string; title: string; link?: string; to?: string }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4 md:mb-12">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-bold tracking-widest text-violet">{eyebrow}</p>}
        <AnimatedText text={title} className="text-3xl font-black leading-tight text-white md:text-5xl" />
      </div>
      {link && to && (
        <Link to={to} className="group hidden items-center gap-2 text-sm font-bold text-mist hover:text-white sm:flex">
          {link}<ArrowLeft size={16} className="transition group-hover:-translate-x-1" />
        </Link>
      )}
    </div>
  );
}
