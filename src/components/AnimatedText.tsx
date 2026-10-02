import { motion, useReducedMotion } from 'framer-motion';
import type { ElementType } from 'react';

/** نمایش کلمه‌به‌کلمه با ماسک — Text Reveal */
export function AnimatedText({ text, as: Tag = 'h2', className = '', delay = 0 }: { text: string; as?: ElementType; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  const lines = text.split('\n');
  return (
    <Tag className={className}>
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.split(' ').map((w, i) => (
            <span key={i} className="inline-block overflow-hidden align-bottom pb-[0.12em] -mb-[0.12em]">
              <motion.span
                className="inline-block"
                initial={reduce ? false : { y: '110%' }}
                whileInView={{ y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: delay + (li * 4 + i) * 0.07, ease: [0.22, 1, 0.36, 1] }}
              >
                {w}&nbsp;
              </motion.span>
            </span>
          ))}
        </span>
      ))}
    </Tag>
  );
}
