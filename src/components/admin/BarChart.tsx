import { fa } from '@/lib/format';

export type Bar = { label: string; value: number; title: string; highlight?: boolean };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** نمودار ستونی SVG (بدون کتابخانه)، با برچسب فارسی و جدول متنی برای دسترسی‌پذیری */
export default function BarChart({ data, unit = 1_000_000, unitLabel = 'میلیون تومان', height = 220 }: { data: Bar[]; unit?: number; unitLabel?: string; height?: number }) {
  const W = 720, H = height, L = 8, R = 44, T = 14, B = 30;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const iw = W - L - R, ih = H - T - B;
  const bw = iw / data.length;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => max * t);
  const every = data.length > 20 ? Math.ceil(data.length / 10) : data.length > 10 ? 2 : 1;
  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`نمودار ستونی، واحد ${unitLabel}`}>
        {ticks.map((t) => {
          const y = T + ih - (t / max) * ih;
          return (
            <g key={t}>
              <line className="grid-l" x1={L} x2={W - R + 4} y1={y} y2={y} />
              <text x={W - R + 10} y={y + 4}>{fa(Math.round((t / unit) * 10) / 10)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.value / max) * ih;
          return (
            <g key={i}>
              <rect className={`cbar${d.highlight ? ' today' : ''}`} x={W - R - (i + 1) * bw + bw * 0.18} y={T + ih - h} width={bw * 0.64} height={Math.max(h, d.value > 0 ? 2 : 0)} rx={3}><title>{d.title}</title></rect>
              {i % every === 0 && <text x={W - R - (i + 1) * bw + bw / 2} y={H - 10} textAnchor="middle">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      <figcaption className="mute" style={{ fontSize: 12, marginTop: 4 }}>واحد: {unitLabel}</figcaption>
      <div className="sr"><table><caption>داده‌های نمودار</caption><tbody>{data.map((d, i) => <tr key={i}><th>{d.label}</th><td>{d.title}</td></tr>)}</tbody></table></div>
    </figure>
  );
}
