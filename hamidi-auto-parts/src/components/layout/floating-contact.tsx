import { MessageCircle, Phone, X } from "lucide-react";
import { SHOP, toFa, whatsappLink } from "@/lib/utils";
import { WhatsAppIcon } from "./whatsapp-icon";

/** Floating contact button – a native <details> disclosure, no JavaScript. */
export function FloatingContact() {
  return (
    <details className="group fixed bottom-5 left-5 z-40">
      <summary className="relative grid size-14 cursor-pointer list-none place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_30px_-8px_rgba(37,211,102,.8)] transition hover:scale-105 [&::-webkit-details-marker]:hidden" aria-label="راه‌های ارتباطی">
        <MessageCircle className="size-6 group-open:hidden" aria-hidden />
        <X className="hidden size-6 group-open:block" aria-hidden />
      </summary>
      <div className="absolute bottom-16 left-0 flex w-max flex-col gap-2 animate-in fade-in slide-in-from-bottom-2">
        <a href={whatsappLink("سلام، برای استعلام قطعه پیام می‌دهم.")} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-full bg-white py-2 pr-4 pl-2 text-sm font-semibold shadow-xl ring-1 ring-black/5 transition hover:-translate-y-0.5">
          <span className="grid size-9 place-items-center rounded-full bg-[#25D366] text-white"><WhatsAppIcon className="size-5" /></span>
          گفتگو در واتساپ
        </a>
        <a href={`tel:${SHOP.phone}`} className="flex items-center gap-2 rounded-full bg-white py-2 pr-4 pl-2 text-sm font-semibold shadow-xl ring-1 ring-black/5 transition hover:-translate-y-0.5">
          <span className="grid size-9 place-items-center rounded-full bg-neutral-950 text-white"><Phone className="size-4" aria-hidden /></span>
          <span className="ltr-nums">{toFa(SHOP.phone)}</span>
        </a>
      </div>
    </details>
  );
}
