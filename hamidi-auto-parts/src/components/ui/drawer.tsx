"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible drawer built on the native <dialog> element:
 * focus trap, Escape-to-close and inert background come from the browser, no library needed.
 */
export function Drawer({
  open,
  onClose,
  title,
  side = "right",
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "right" | "bottom" | "center";
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        "m-0 max-h-none max-w-none bg-white p-0 text-neutral-950 backdrop:bg-black/55 backdrop:backdrop-blur-[2px] open:flex open:flex-col",
        side === "right" && "inset-y-0 right-0 left-auto h-dvh w-[88%] max-w-sm open:animate-in open:slide-in-from-right",
        side === "bottom" && "inset-x-0 top-auto bottom-0 max-h-[88dvh] w-full rounded-t-3xl open:animate-in open:slide-in-from-bottom",
        side === "center" && "m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl open:animate-in open:zoom-in-95",
        className,
      )}
    >
      <button type="button" onClick={onClose} aria-label="بستن" className="absolute top-4 left-4 z-10 grid size-9 cursor-pointer place-items-center rounded-full bg-neutral-100 text-neutral-700 transition hover:bg-neutral-200">
        <X className="size-4" />
      </button>
      {open && children}
    </dialog>
  );
}
