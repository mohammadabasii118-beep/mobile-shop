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
    <footer className="mt-10 pb-32 md:pb-24">
      <Container>
        <div className="grid gap-8 border-t border-border py-10 text-sm sm:grid-cols-2 lg:grid-cols-[1.3fr_0.7fr_1.1fr_0.8fr]">
          <div>
            <Logo />
            <p className="mt-4 leading-8 text-muted">{info.footerText}</p>
          </div>
          <div>
            <h4 className="mb-3 font-extrabold">خدمات ما</h4>
            <ul className="space-y-2 text-muted">
              {links.map((l) => (
                <li key={l.id}><Link href={l.link ?? "/"} {...(l.link === "/account" ? { "data-account-link": "" } : {})} className="inline-block transition-all duration-150 hover:-translate-x-0.5 hover:text-primary">{l.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-extrabold">اطلاعات تماس</h4>
            <ul className="space-y-3">
              {rows.map(({ i: I, t, href }) => {
                const inner = (<><span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/12 text-primary transition-colors group-hover:bg-primary/20"><I className="size-4" /></span><span dir="auto">{t}</span></>);
                return <li key={t}>{href ? <a href={href} className="group flex items-center gap-2 text-muted transition-colors hover:text-primary">{inner}</a> : <span className="group flex cursor-default items-center gap-2 text-muted transition-colors hover:text-primary">{inner}</span>}</li>;
              })}
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-extrabold">نماد اعتماد</h4>
            <div className="grid h-24 w-28 place-items-center rounded-lg border border-dashed border-border bg-surface p-2 text-center text-[11px] text-muted">محل نماد اعتماد الکترونیکی</div>
          </div>
        </div>
        <p className="text-center text-xs text-muted">© {new Date().toLocaleDateString("fa-IR", { year: "numeric" })} {info.name}</p>
      </Container>
    </footer>
  );
}
