import { Clock, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui";
import { Logo } from "@/components/header";
import { getMenu, getSiteInfo } from "@/lib/queries";

export async function Footer() {
  const [info, links] = await Promise.all([getSiteInfo(), getMenu("footer")]);
  const rows = [
    { i: Clock, t: info.hours, href: undefined as string | undefined },
    { i: Phone, t: info.phone, href: `tel:${info.phone.replace(/[^\d+]/g, "")}` },
    { i: Mail, t: info.email.toUpperCase(), href: `mailto:${info.email}` },
    { i: MapPin, t: `آدرس: ${info.address}`, href: undefined },
  ].filter((r) => r.t.trim());
  return (
    <footer className="mt-10 border-t border-border bg-surface pb-24 lg:pb-0">
      <Container>
        <div className="grid gap-10 py-12 text-sm sm:grid-cols-2 lg:grid-cols-[1.4fr_0.7fr_1.1fr_0.8fr] lg:gap-14 lg:py-16">
          <div>
            <Logo logo={info.logo} name={info.name} />
            <p className="font-display mt-6 max-w-[22rem] text-[26px] leading-[1.3] text-foreground">{info.footerText || "قاب و لوازم جانبی که به گوشی تو می‌خورد."}</p>
          </div>
          <div>
            <p className="mb-4 text-[12px] font-bold tracking-wide text-muted">خدمات ما</p>
            <ul className="space-y-2.5">
              {links.map((l) => (
                <li key={l.id}><Link href={l.link ?? "/"} className="inline-block text-[14px] font-medium transition-colors hover:text-primary">{l.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-4 text-[12px] font-bold tracking-wide text-muted">اطلاعات تماس</p>
            <ul className="space-y-3">
              {rows.map(({ i: I, t, href }) => {
                const inner = (<><I className="mt-1 size-4 shrink-0 text-primary" strokeWidth={1.8} /><span dir="auto" className="leading-7">{t}</span></>);
                return <li key={t}>{href ? <a href={href} className="flex items-start gap-3 text-foreground/85 transition-colors hover:text-primary">{inner}</a> : <span className="flex items-start gap-3 text-foreground/85">{inner}</span>}</li>;
              })}
            </ul>
          </div>
          <div>
            <p className="mb-4 text-[12px] font-bold tracking-wide text-muted">نماد اعتماد</p>
            <div className="grid h-24 w-28 place-items-center rounded-[10px] border border-dashed border-border-strong bg-card p-2 text-center text-[11px] text-muted">محل نماد اعتماد الکترونیکی</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-5 text-[12px] text-muted">
          <p>© {new Date().toLocaleDateString("fa-IR", { year: "numeric" })} {info.name}. همه حقوق محفوظ است.</p>
          <p dir="ltr" className="font-bold uppercase tracking-[0.18em]">CASELINE</p>
        </div>
      </Container>
    </footer>
  );
}
