"use client";

import { useEffect, useState } from "react";

export type Capability = { status: "checking" | "yes" | "no"; quality: "high" | "low"; reducedMotion: boolean };

interface NavigatorExtras {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

/** DESIGN.md §9.7 — تصمیم می‌گیرد 3D اجرا شود یا fallback دو‌بعدی */
export function useCanUse3D(): Capability {
  const [cap, setCap] = useState<Capability>({ status: "checking", quality: "high", reducedMotion: false });

  useEffect(() => {
    const nav = navigator as Navigator & NavigatorExtras;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {}
    const saveData = !!nav.connection?.saveData;
    const lowMem = (nav.deviceMemory ?? 8) <= 2;
    const lowCpu = (nav.hardwareConcurrency ?? 8) <= 2;
    const small = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
    setCap({
      status: webgl && !saveData && !lowMem && !lowCpu ? "yes" : "no",
      quality: small ? "low" : "high",
      reducedMotion,
    });
  }, []);

  return cap;
}
