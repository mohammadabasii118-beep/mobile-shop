"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { APP_NAME } from "@/config/app";
import { cn } from "@/lib/cn";
import { useSettings } from "@/hooks/api";
import { NAV } from "./nav";

function isActive(pathname: string, href: string) {
  if (href === "/dashboard" || href === "/instagram" || href === "/telegram") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: settings } = useSettings();
  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-16 items-center gap-2.5 border-b px-5">
        <div className="rounded-lg bg-primary p-1.5 text-primary-foreground"><Sparkles className="size-5" /></div>
        <span className="text-lg font-semibold tracking-tight">{settings?.appName ?? APP_NAME}</span>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        {NAV.map((g, i) => (
          <div key={i}>
            {g.title && <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{g.title}</p>}
            <ul className="space-y-0.5">
              {g.items.map(({ label, href, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                      className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition", active ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                    >
                      <Icon className="size-4" />{label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t p-4">
        <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Connected Accounts</p>
        {[["Instagram", "@caseline.official"], ["Telegram", "@caseline"]].map(([n, h]) => (
          <div key={n} className="flex items-center justify-between py-1 text-sm">
            <span>{n}</span>
            <span className="flex items-center gap-1.5 text-xs text-success" title={h}><span className="size-2 rounded-full bg-success" />Connected</span>
          </div>
        ))}
      </div>
    </div>
  );
}
