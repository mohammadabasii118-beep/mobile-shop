"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Store, X } from "lucide-react";

const KEY = "caseline:partner-card:dismissed";
const LABEL: Record<string, [string, string]> = {
  PENDING: ["درخواست همکاری شما در حال بررسی است.", "مشاهده وضعیت"],
  CHANGES_REQUESTED: ["برای ادامهٔ بررسی، اصلاحاتی از شما خواسته شده است.", "مشاهده و اصلاح درخواست"],
  REJECTED: ["درخواست همکاری قبلی شما تأیید نشد.", "مشاهده وضعیت و درخواست مجدد"],
};

/**
 * Optional entry point to the EXISTING cooperation application (/account/wholesale). Never blocks anything:
 * a new user can dismiss it (remembered in this browser); when an application exists it shows the real status instead of the call to action.
 * The status comes from the database (server), never from the browser.
 */
export function PartnerCard({ status }: { status: string | null }) {
  const [hidden, setHidden] = useState(false); // visible in the server HTML; a dismissed card is hidden right after mount
  useEffect(() => { try { if (!status && localStorage.getItem(KEY) === "1") setHidden(true); } catch { /* storage blocked: keep showing */ } }, [status]); // eslint-disable-line react-hooks/set-state-in-effect
  if (hidden) return null;
  const s = status ? LABEL[status] : null;
  return (
    <section className="relative mb-4 flex flex-wrap items-center gap-3 rounded-[16px] border border-primary/30 bg-primary/5 p-4" data-testid="partner-card" data-status={status ?? "none"} aria-label="همکاری با CaseLine">
      <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-primary/12 text-primary"><Store className="size-5" /></span>
      <div className="min-w-[12rem] flex-1 pe-6">
        <h2 className="text-[15px] font-extrabold">همکاری با CaseLine</h2>
        <p className="mt-0.5 text-xs leading-6 text-muted">{s ? s[0] : "اگر فروشگاه اینترنتی، پیج اینستاگرام یا فروشگاه فیزیکی دارید، می‌توانید برای همکاری تجاری با CaseLine درخواست ارسال کنید."}</p>
      </div>
      <Link href="/account/wholesale" className="flex h-10 w-full shrink-0 items-center justify-center rounded-[10px] bg-primary px-5 sm:w-auto text-sm font-bold text-primary-fg hover:bg-primary-hover" data-testid="partner-cta">{s ? s[1] : "درخواست همکاری"}</Link>
      {!status && <button type="button" aria-label="بستن" onClick={() => { try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ } setHidden(true); }} className="absolute end-2 top-2 grid size-7 cursor-pointer place-items-center rounded-full text-muted hover:bg-surface-2" data-testid="partner-dismiss"><X className="size-4" /></button>}
    </section>
  );
}
