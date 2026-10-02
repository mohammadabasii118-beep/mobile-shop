"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SimulationProvider } from "@/modules/simulation/simulation-provider";
import { DemoBanner } from "./demo-banner";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function PanelShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <SimulationProvider>
      <div className="min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r lg:block"><Sidebar /></aside>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <aside className="animate-step-in absolute inset-y-0 left-0 w-72 border-r shadow-xl"><Sidebar onNavigate={() => setOpen(false)} /></aside>
          </div>
        )}
        <div className="lg:pl-64">
          <DemoBanner />
          <Topbar onMenu={() => setOpen(true)} />
          <main className="mx-auto max-w-[1400px] p-4 lg:p-8">{children}</main>
        </div>
      </div>
    </SimulationProvider>
  );
}
