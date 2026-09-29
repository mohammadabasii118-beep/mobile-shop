"use client";
import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "caseline_compare_v1";
const MAX_COMPARE = 4;

type CompareCtx = {
  ids: string[];
  isComparing: (id: string) => boolean;
  toggleCompare: (id: string) => void;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
  full: boolean;
};

const Ctx = createContext<CompareCtx | null>(null);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setIds(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {}
  }, [ids, hydrated]);

  function toggleCompare(id: string) {
    setIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev; // silently capped; UI disables the button instead
      return [...prev, id];
    });
  }

  function removeFromCompare(id: string) {
    setIds((prev) => prev.filter((x) => x !== id));
  }

  function clearCompare() {
    setIds([]);
  }

  return (
    <Ctx.Provider
      value={{
        ids,
        isComparing: (id) => ids.includes(id),
        toggleCompare,
        removeFromCompare,
        clearCompare,
        full: ids.length >= MAX_COMPARE,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCompare() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCompare must be used within CompareProvider");
  return ctx;
}

export { MAX_COMPARE };
