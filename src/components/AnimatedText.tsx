import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';

function Word({ word, index, total, progress }: { word: string; index: number; total: number; progress: MotionValue<number> }) {
  const start = index / total;
  const end = start + 1 / total;
  const opacity = useTransform(progress, [start, end], [0.2, 1]);
  return (
    <span className="relative inline-block">
      <span className="invisible">{word}</span>
      <motion.span className="absolute right-0 top-0 whitespace-nowrap" style={{ opacity }}>
        {word}
      </motion.span>
    </span>
  );
}

/* Scroll-reveal text. Animates word by word (not char by char) because
   splitting Persian into single characters would break letter joining. */
export default function AnimatedText({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.2'] });
  const words = text.split(' ');

  return (
    <p ref={ref} className={className} style={style}>
      {words.map((w, i) => (
        <span key={i}>
          <Word word={w} index={i} total={words.length} progress={scrollYProgress} />
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  );
}
