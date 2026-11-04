"use client";

import { useEffect, useState } from "react";
import { toFa } from "@/lib/utils";

function nextDeadline() {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

export function Countdown() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const target = nextDeadline();
    const tick = () => setLeft(Math.max(0, target - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.floor((left ?? 0) / 1000);
  const parts = [
    { v: Math.floor(s / 3600), l: "ساعت" },
    { v: Math.floor((s % 3600) / 60), l: "دقیقه" },
    { v: s % 60, l: "ثانیه" },
  ];
  return (
    <div className="flex items-center gap-2" dir="ltr">
      {parts.map((p, i) => (
        <div key={p.l} className="flex items-center gap-2">
          <div className="flex w-16 flex-col items-center rounded-2xl bg-white/10 py-2 ring-1 ring-white/10 backdrop-blur">
            <span className="text-2xl font-black tabular-nums">{left === null ? "--" : toFa(String(p.v).padStart(2, "0"))}</span>
            <span className="text-[10px] text-neutral-400">{p.l}</span>
          </div>
          {i < 2 && <span className="text-xl font-black text-primary">:</span>}
        </div>
      ))}
    </div>
  );
}
