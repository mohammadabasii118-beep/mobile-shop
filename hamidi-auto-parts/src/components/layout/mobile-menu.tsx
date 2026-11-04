"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";

/** Opens the server-rendered navigation (passed as children) in a native <dialog> drawer. */
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} className="grid size-12 cursor-pointer place-items-center rounded-2xl border border-neutral-300 text-neutral-900 transition hover:bg-neutral-100 lg:hidden" aria-label="باز کردن منو">
        <Menu className="size-5" />
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="منوی اصلی">
        {/* close the drawer when any link inside is followed */}
        <div className="flex h-full flex-col" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
          {children}
        </div>
      </Drawer>
    </>
  );
}
