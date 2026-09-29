"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";

type Theme = "light" | "dark";

const STORAGE_KEY = "caseline_theme";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeToggle() {
  // Mirrors whatever ThemeScript already applied to <html data-theme> on
  // first paint, so there is no mismatch between the toggle icon and the
  // actual active theme.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as Theme | null) || getSystemTheme();
    setTheme(current);
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage may be unavailable (private mode, blocked storage); the
      // toggle still works for the current page view.
    }
  }

  function toggle() {
    apply((theme || getSystemTheme()) === "dark" ? "light" : "dark");
  }

  return (
    <button
      onClick={toggle}
      className="w-10 h-10 rounded-full flex items-center justify-center"
      aria-label={theme === "dark" ? "تغییر به حالت روشن" : "تغییر به حالت تاریک"}
      title={theme === "dark" ? "حالت روشن" : "حالت تاریک"}
      type="button"
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} className="w-5 h-5" />
    </button>
  );
}
