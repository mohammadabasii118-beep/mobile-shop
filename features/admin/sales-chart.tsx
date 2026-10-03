"use client";

import { useMemo, useState } from "react";
import type { DayStat } from "@/data/admin";
import { formatCompact, formatNumber } from "@/lib/format";

const fmtDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long", timeZone: "UTC" });
const H = 220;

/**
 * نمودار درآمد — تک‌رنگ (accent) + خط قبلی کم‌رنگ. محور زمان RTL: قدیمی‌ترین سمت راست.
 * برچسب‌ها HTML هستند (نه داخل SVG) تا در موبایل اندازهٔ خواناشان حفظ شود.
 */
export function SalesChart({ series, prev }: { series: DayStat[]; prev: DayStat[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000;
  const max = useMemo(() => Math.max(...series.map((d) => d.revenue), ...prev.map((d) => d.revenue)) * 1.1, [series, prev]);
  const n = series.length;
  const x = (i: number) => W - (i / (n - 1)) * W; // i=0 → راست
  const y = (v: number) => H - (v / max) * H;
  const line = (xs: DayStat[]) => xs.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.revenue).toFixed(1)}`).join(" ");
  const area = `${line(series)} L${x(n - 1)},${H} L${x(0)},${H} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const idx = hover ?? n - 1;
  const d = series[idx];
  const total = series.reduce((s, v) => s + v.revenue, 0);

  return (
    <div>
      <div className="flex">
        <ul className="flex w-14 shrink-0 flex-col-reverse justify-between whitespace-nowrap text-[11px] text-muted" style={{ height: H }} aria-hidden>
          {ticks.map((t) => <li key={t} className="num leading-none">{formatCompact(t)}</li>)}
        </ul>
        <div
          className="relative min-w-0 flex-1 touch-pan-y"
          style={{ height: H }}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const fromRight = (r.right - e.clientX) / r.width;
            setHover(Math.max(0, Math.min(n - 1, Math.round(fromRight * (n - 1)))));
          }}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`نمودار درآمد ${formatNumber(n)} روز اخیر؛ مجموع ${formatNumber(total)} تومان`}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            {ticks.map((t) => <line key={t} x1="0" x2={W} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
            <path d={area} fill="var(--accent)" opacity="0.1" />
            {prev.length === n && <path d={line(prev)} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" vectorEffect="non-scaling-stroke" />}
            <path d={line(series)} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="pointer-events-none absolute inset-y-0 w-px bg-fg/25" style={{ insetInlineStart: `${(idx / (n - 1)) * 100}%` }} />
          <div className="pointer-events-none absolute size-3 -translate-y-1/2 rounded-full bg-accent ring-4 ring-bg" style={{ insetInlineStart: `${(idx / (n - 1)) * 100}%`, top: `${(y(d.revenue) / H) * 100}%`, marginInlineStart: "-6px" }} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-y-2 ps-14 text-xs text-muted">
        <span className="num">{fmtDate.format(new Date(series[0].date))}</span>
        <span className="order-last flex w-full flex-wrap items-baseline gap-x-2 text-sm text-fg sm:order-none sm:w-auto">
          <span className="text-muted">{fmtDate.format(new Date(d.date))}</span>
          <b className="num">{formatNumber(d.revenue)}</b> <span className="text-muted">تومان · {formatNumber(d.orders)} سفارش</span>
        </span>
        <span className="num">{fmtDate.format(new Date(series[n - 1].date))}</span>
      </div>
    </div>
  );
}
