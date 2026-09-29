import type { Metadata } from "next";
import { MessagesSquare, Plus } from "lucide-react";
import { AccountShell } from "@/components/account-shell";
import { requirePageUser } from "@/lib/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تیکت‌های پشتیبانی | CaseLine" };
const field = "w-full rounded-xl border border-border bg-surface px-4 text-sm outline-none focus:border-primary";

export default async function TicketsPage() {
  await requirePageUser("/account/tickets");
  return (
    <AccountShell active="tickets">
      <div data-tickets-root>
        <button data-ticket-new className="flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-fg shadow-md hover:bg-primary-hover">تیکت جدید<Plus className="size-4" /></button>
        <form data-ticket-form hidden className="mt-4 space-y-3 rounded-2xl border border-border bg-surface-2 p-4">
          <input name="subject" required placeholder="موضوع تیکت" className={`${field} h-11`} />
          <textarea name="message" required rows={4} placeholder="پیام خود را بنویسید…" className={`${field} py-3 leading-7`} />
          <div className="flex gap-2">
            <button type="submit" className="h-11 flex-1 cursor-pointer rounded-xl bg-primary text-sm font-bold text-primary-fg hover:bg-primary-hover">ارسال تیکت</button>
            <button type="button" data-ticket-cancel className="h-11 cursor-pointer rounded-xl bg-surface px-5 text-sm text-muted">انصراف</button>
          </div>
        </form>
        <div data-ticket-list className="mt-4 space-y-3" />
        <div data-ticket-empty className="mt-4 rounded-2xl border border-dashed border-primary/30 px-4 py-9 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-primary/10 text-primary"><MessagesSquare className="size-6" /></span>
          <p className="mt-3 text-xs text-muted">هنوز تیکتی نساخته‌اید. اگر سوال یا مشکلی دارید، از دکمه بالا تیکت بزنید.</p>
        </div>
      </div>
    </AccountShell>
  );
}
