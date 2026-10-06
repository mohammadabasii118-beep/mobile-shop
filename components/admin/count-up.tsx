"use client";
import { useEffect, useRef, useState } from "react";

const FA = "۰۱۲۳۴۵۶۷۸۹";
const toNum = (s: string) => Number([...s].map((c) => (FA.includes(c) ? String(FA.indexOf(c)) : c)).filter((c) => /\d/.test(c)).join(""));
const fmt = (n: number) => n.toLocaleString("fa-IR");

/** Counts the first number in a pre-formatted Persian string up from zero (the server-rendered text is already the final value: no flash, works without JS). */
export function CountUp({ text, ms = 900 }: { text: string; ms?: number }) {
  const raw = text.match(/[۰-۹0-9][۰-۹0-9٬,]*/)?.[0] ?? null;
  const [shown, setShown] = useState<string | null>(null);
  const done = useRef(false);
  useEffect(() => {
    if (!raw || done.current) return;
    done.current = true;
    const root = document.querySelector("[data-admin-fx]");
    if (root?.getAttribute("data-admin-fx") !== "on" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = toNum(raw); if (!Number.isFinite(to) || to < 2) return;
    let raf = 0; const start = performance.now();
    const tick = (t: number) => { const k = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - k, 3); setShown(fmt(Math.round(to * e))); if (k < 1) raf = requestAnimationFrame(tick); else setShown(null); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [raw, ms]);
  if (!raw || shown === null) return <>{text}</>;
  return <>{text.replace(raw, shown)}</>;
}
