import Reveal from "@/components/ui/Reveal";

// Generic brand-style wordmarks (demo placeholders, not real logos).
const brands = ["NOVA", "AURA", "FLUX", "ORBIT", "PULSE", "LUMEN"];

export default function Brands() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Reveal>
        <p className="mb-6 text-center text-xs font-semibold tracking-widest text-silver-500">
          برندهای معتبر همکار (نمایشی)
        </p>
        <div className="glass flex flex-wrap items-center justify-center gap-x-10 gap-y-6 rounded-2xl px-6 py-7">
          {brands.map((b) => (
            <span
              key={b}
              className="select-none text-lg font-black tracking-widest text-silver-400/60 transition hover:text-silver-200"
            >
              {b}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
