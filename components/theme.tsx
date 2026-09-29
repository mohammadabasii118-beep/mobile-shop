"use client";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export const THEME_KEY = "caseline-theme";

/** Runs synchronously in <head> before first paint — prevents theme flash. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

type Mode = "light" | "dark" | "system";

function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    try { setMode((localStorage.getItem(THEME_KEY) as Mode) || "system"); } catch {}
  }, []);
  useEffect(() => {
    if (mode !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => apply("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [mode]);

  const choose = (m: Mode) => {
    setMode(m);
    try { localStorage.setItem(THEME_KEY, m); } catch {}
    apply(m);
  };
  const items: { m: Mode; icon: typeof Sun; label: string }[] = [
    { m: "light", icon: Sun, label: "روشن" },
    { m: "dark", icon: Moon, label: "تیره" },
    { m: "system", icon: Monitor, label: "سیستم" },
  ];
  return (
    <div role="radiogroup" aria-label="تم" className="inline-flex rounded-full border border-border bg-surface p-0.5">
      {items.map(({ m, icon: Icon, label }) => (
        <button key={m} role="radio" aria-checked={mode === m} aria-label={label} title={label} onClick={() => choose(m)}
          className={cn("grid size-8 cursor-pointer place-items-center rounded-full text-muted transition-colors", mode === m && "bg-secondary text-secondary-fg")}>
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
