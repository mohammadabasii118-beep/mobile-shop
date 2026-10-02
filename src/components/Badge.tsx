import type { ReactNode } from 'react';
const tones = {
  violet: 'bg-violet/20 text-violet border-violet/30',
  pink: 'bg-magenta/20 text-magenta border-magenta/30',
  orange: 'bg-amber/20 text-amber border-amber/30',
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
  gray: 'bg-white/5 text-mist/70 border-white/10',
  sky: 'bg-sky/15 text-sky border-sky/30',
} as const;
export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: keyof typeof tones }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}
