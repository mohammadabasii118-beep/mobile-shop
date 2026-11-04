"use client";

import { useState } from "react";
import { MessageCircle, Phone, X } from "lucide-react";
import { SHOP, cn, toFa, whatsappLink } from "@/lib/utils";
import { WhatsAppIcon } from "./whatsapp-icon";

export function FloatingContact() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-5 left-5 z-40 flex flex-col items-start gap-3">
      <div className={cn("flex flex-col gap-2 transition-all duration-300", open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0")}>
        <a href={whatsappLink("سلام، برای استعلام قطعه پیام می‌دهم.")} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full bg-white py-2 pr-4 pl-2 text-sm font-semibold shadow-xl ring-1 ring-black/5 transition hover:-translate-y-0.5">
          <span className="grid size-9 place-items-center rounded-full bg-[#25D366] text-white"><WhatsAppIcon className="size-5" /></span>
          گفتگو در واتساپ
        </a>
        <a href={`tel:${SHOP.phone}`} className="flex items-center gap-2 rounded-full bg-white py-2 pr-4 pl-2 text-sm font-semibold shadow-xl ring-1 ring-black/5 transition hover:-translate-y-0.5">
          <span className="grid size-9 place-items-center rounded-full bg-neutral-950 text-white"><Phone className="size-4" /></span>
          <span className="ltr-nums">{toFa(SHOP.phone)}</span>
        </a>
      </div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="راه‌های ارتباطی"
        className="relative grid size-14 cursor-pointer place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_30px_-8px_rgba(37,211,102,.8)] transition hover:scale-105"
      >
        {!open && <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-30" />}
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </div>
  );
}
