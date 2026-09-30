"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
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
    // Read after mount so server and client markup match (no hydration mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

/** One-tap night mode button used in the mobile bottom bar. */
/** Live "is dark mode on" (follows the <html class="dark"> flag, so every night button stays in sync with the real theme). */
function subscribeDark(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
}
const getDark = () => document.documentElement.classList.contains("dark");
export const useIsDark = () => useSyncExternalStore(subscribeDark, getDark, () => false);

/**
 * Night-mode toggle. `aria-pressed` mirrors the real theme (on → highlighted, tap again → off).
 * `tab`: bottom-bar item (highlighted tile when on). `withSwitch`: shows a small on/off switch (menu row).
 */
export function NightButton({ className, iconOnly, tab, withSwitch }: { className?: string; iconOnly?: boolean; tab?: boolean; withSwitch?: boolean }) {
  const dark = useIsDark();
  const toggle = () => {
    const next: Mode = document.documentElement.classList.contains("dark") ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, next); } catch {}
    apply(next);
  };
  return (
    <button type="button" data-night aria-label="حالت شب" aria-pressed={dark} onClick={toggle} className={cn(tab && "night-tab", className)}>
      {tab ? <Moon className="size-5" /> : <><Moon className="size-5 dark:hidden" /><Sun className="hidden size-5 dark:block" /></>}
      {!iconOnly && <span className={withSwitch ? "flex-1 text-start" : undefined}>حالت شب</span>}
      {withSwitch && <span aria-hidden className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", dark ? "bg-primary" : "bg-border")}><span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", dark ? "start-[22px]" : "start-0.5")} /></span>}
    </button>
  );
}
