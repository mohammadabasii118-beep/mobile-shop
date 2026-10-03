import type { DayStat } from "@/data/admin";

export type Range = 7 | 30;

const sum = (xs: DayStat[], k: "revenue" | "orders" | "visits") => xs.reduce((s, x) => s + x[k], 0);

/** KPIها و مقایسه با بازهٔ قبل — منطق Business جدا از UI */
export function computeKpis(all: DayStat[], range: Range) {
  const cur = all.slice(-range);
  const prev = all.slice(-range * 2, -range);
  const pct = (a: number, b: number) => (b === 0 ? 0 : ((a - b) / b) * 100);
  const rev = sum(cur, "revenue"), revP = sum(prev, "revenue");
  const ord = sum(cur, "orders"), ordP = sum(prev, "orders");
  const vis = sum(cur, "visits"), visP = sum(prev, "visits");
  const aov = ord ? rev / ord : 0, aovP = ordP ? revP / ordP : 0;
  const conv = vis ? (ord / vis) * 100 : 0, convP = visP ? (ordP / visP) * 100 : 0;
  return {
    series: cur,
    prevSeries: prev,
    revenue: { value: rev, delta: pct(rev, revP) },
    orders: { value: ord, delta: pct(ord, ordP) },
    aov: { value: aov, delta: pct(aov, aovP) },
    conversion: { value: conv, delta: pct(conv, convP) },
  };
}
