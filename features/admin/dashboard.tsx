"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, PackagePlus } from "lucide-react";
import { dailyStats, lowStock, orderStatusLabel, recentOrders, topCategories, type OrderStatus } from "@/data/admin";
import { computeKpis, type Range } from "@/lib/admin-stats";
import { formatDecimal, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { SalesChart } from "./sales-chart";
import { cn } from "@/lib/utils";

const statusVariant: Record<OrderStatus, "success" | "warning" | "neutral" | "danger" | "accent"> = {
  paid: "success", processing: "warning", shipped: "accent", pending: "neutral", cancelled: "danger",
};

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("min-w-0 rounded-lg bg-surface p-4 shadow-hairline md:p-5", className)}>{children}</section>;
}

function Delta({ value }: { value: number }) {
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("num inline-flex items-center gap-0.5 text-xs font-semibold", up ? "text-success" : "text-danger")}>
      <Icon className="size-3.5" aria-hidden />
      {formatDecimal(Math.abs(value))}٪
      <span className="sr-only">{up ? "افزایش" : "کاهش"}</span>
    </span>
  );
}

export function Dashboard() {
  const [range, setRange] = useState<Range>(30);
  const k = useMemo(() => computeKpis(dailyStats, range), [range]);

  const kpis = [
    { label: "درآمد", value: k.revenue.value, unit: "تومان", delta: k.revenue.delta },
    { label: "سفارش‌ها", value: k.orders.value, unit: "", delta: k.orders.delta },
    { label: "میانگین سفارش", value: k.aov.value, unit: "تومان", delta: k.aov.delta },
    { label: "نرخ تبدیل", value: k.conversion.value, unit: "٪", delta: k.conversion.delta, decimal: true },
  ];

  return (
    <div className="mx-auto min-w-0 max-w-[1400px] space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="t-h2">داشبورد</h1>
          <p className="t-small text-muted">خلاصهٔ عملکرد فروشگاه در {formatNumber(range)} روز اخیر</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="بازهٔ زمانی" className="flex rounded-full bg-secondary p-1">
            {([7, 30] as const).map((r) => (
              <button key={r} onClick={() => setRange(r)} aria-pressed={range === r} className={cn("min-h-9 rounded-full px-4 text-sm font-semibold transition-colors", range === r ? "bg-primary text-primary-fg" : "text-muted hover:text-fg")}>
                {formatNumber(r)} روز
              </button>
            ))}
          </div>
          <Button variant="accent" size="sm"><PackagePlus /> محصول جدید</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {kpis.map((m) => (
          <Card key={m.label}>
            <p className="t-caption text-muted">{m.label}</p>
            <p className="price mt-2 text-xl md:text-2xl">
              {m.decimal ? <span className="num">{formatDecimal(m.value)}</span> : <AnimatedNumber value={m.value} />}
              {m.unit && <span className="ms-1 text-xs font-medium text-muted">{m.unit}</span>}
            </p>
            <div className="mt-2 flex items-center gap-2"><Delta value={m.delta} /><span className="t-caption text-muted">نسبت به قبل</span></div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="t-h3">درآمد</h2>
            <div className="t-caption flex items-center gap-4 text-muted">
              <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded bg-accent" /> این بازه</span>
              <span className="flex items-center gap-1.5"><i className="h-0 w-4 border-t border-dashed border-muted" /> بازهٔ قبل</span>
            </div>
          </div>
          <SalesChart series={k.series} prev={k.prevSeries} />
        </Card>

        <Card>
          <h2 className="t-h3 mb-5">سهم دسته‌ها از فروش</h2>
          <ul className="space-y-4">
            {topCategories.map((c) => (
              <li key={c.name}>
                <div className="mb-1.5 flex justify-between text-sm"><span>{c.name}</span><span className="num text-muted">{formatNumber(c.share)}٪</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary" role="presentation"><div className="h-full rounded-full bg-accent" style={{ width: `${c.share * 2}%` }} /></div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-2">
          <div className="mb-4 flex items-center justify-between"><h2 className="t-h3">آخرین سفارش‌ها</h2><a href="/admin/orders" className="text-sm text-muted hover:text-fg">همه</a></div>
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <table className="w-full min-w-[34rem] text-sm">
              <caption className="sr-only">آخرین سفارش‌های ثبت‌شده</caption>
              <thead>
                <tr className="border-b border-line text-start text-xs text-muted">
                  {["سفارش", "مشتری", "محصول", "وضعیت", "مبلغ (تومان)"].map((h, i) => <th key={h} scope="col" className={cn("pb-3 font-medium", i === 4 ? "text-end" : "text-start")}>{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recentOrders.map((o) => (
                  <tr key={o.id} className="transition-colors hover:bg-secondary/40">
                    <td className="py-3 pe-3"><bdi className="num font-semibold">{o.id}</bdi><div className="t-caption text-muted">{o.time}</div></td>
                    <td className="pe-3">{o.customer}</td>
                    <td className="max-w-48 truncate pe-3 text-muted">{o.item}</td>
                    <td className="pe-3"><Badge variant={statusVariant[o.status]}>{orderStatusLabel[o.status]}</Badge></td>
                    <td className="num text-end font-semibold">{formatNumber(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="t-h3 mb-4">کم‌موجودی انبار</h2>
          <ul className="space-y-4">
            {lowStock.map((s) => {
              const ratio = Math.min(1, s.stock / s.threshold);
              return (
                <li key={s.name}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm"><span className="truncate">{s.name}</span>
                    {s.stock === 0 ? <Badge variant="danger">ناموجود</Badge> : <span className="num text-warning">{formatNumber(s.stock)} عدد</span>}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className={cn("h-full rounded-full", s.stock === 0 ? "bg-danger" : "bg-warning")} style={{ width: `${Math.max(ratio * 100, 3)}%` }} /></div>
                </li>
              );
            })}
          </ul>
          <Button variant="outline" size="sm" className="mt-5 w-full">ثبت سفارش خرید</Button>
        </Card>
      </div>
    </div>
  );
}
