"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Only the active-state highlighting needs the pathname; the link itself is plain HTML. */
export function NavLink({ href, children, className, activeClassName }: { href: string; children: React.ReactNode; className?: string; activeClassName?: string }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn(className, active && activeClassName)}>
      {children}
    </Link>
  );
}
