import { ChevronDown } from "lucide-react";

/** Native <details> accordion – accessible and JavaScript-free. */
export function Faq({ items, title = "سؤالات متداول" }: { items: { q: string; a: string }[]; title?: string }) {
  return (
    <section aria-labelledby="faq-title">
      <h2 id="faq-title" className="mb-5 text-xl font-black">{title}</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((f) => (
          <details key={f.q} className="group rounded-2xl border border-neutral-200 bg-white p-5 open:border-neutral-950">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden">
              <h3 className="text-[15px]">{f.q}</h3>
              <ChevronDown className="size-5 shrink-0 transition group-open:rotate-180" aria-hidden />
            </summary>
            <p className="mt-3 text-sm leading-7 text-neutral-700">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
