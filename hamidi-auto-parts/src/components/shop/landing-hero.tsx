import Image from "next/image";
import { Breadcrumbs } from "./breadcrumbs";
import type { Crumb } from "@/lib/seo";

/** Dark hero used by brand / model landing pages. */
export function LandingHero({
  crumbs,
  eyebrow,
  title,
  intro,
  watermark,
  image,
  stats,
}: {
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  intro: string;
  watermark: string;
  image: string;
  stats: { value: string; label: string }[];
}) {
  return (
    <section className="carbon relative overflow-hidden text-white" aria-labelledby="page-title">
      <div className="bg-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
      <div className="pointer-events-none absolute hidden sm:block top-0 left-1/4 size-[420px] rounded-full bg-primary/25 blur-[120px]" aria-hidden />
      <span className="pointer-events-none absolute -bottom-10 left-0 text-[8rem] leading-none font-black tracking-tighter text-white/[0.04] sm:text-[14rem]" dir="ltr" aria-hidden>{watermark}</span>
      <div className="container-x relative grid items-center gap-8 py-10 lg:grid-cols-[1.3fr_1fr] lg:py-14">
        <div>
          <Breadcrumbs items={crumbs} dark />
          <p className="mt-6 inline-block rounded-md bg-primary px-2.5 py-1 text-xs font-black tracking-[0.25em]" dir="ltr">{eyebrow}</p>
          <h1 id="page-title" className="mt-4 text-3xl font-black sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl leading-8 text-neutral-300">{intro}</p>
          <dl className="mt-6 flex flex-wrap gap-6 text-sm">
            {stats.map((s, i) => (
              <div key={s.label} className={i > 0 ? "flex flex-col-reverse border-r border-white/10 pr-6" : "flex flex-col-reverse"}>
                <dt className="text-neutral-300">{s.label}</dt>
                <dd className="text-2xl font-black">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Image src={image} alt="" width={1200} height={1200} sizes="320px" className="mx-auto hidden size-80 animate-float object-contain drop-shadow-[0_40px_50px_rgba(0,0,0,.6)] motion-reduce:animate-none lg:block" />
      </div>
    </section>
  );
}
