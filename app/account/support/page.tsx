import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "پشتیبانی" };

const statusLabel: Record<string, string> = { OPEN: "در انتظار پاسخ پشتیبانی", ANSWERED: "پاسخ داده شد", CLOSED: "بسته‌شده" };

export default async function SupportListPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const tickets = await db.supportTicket.findMany({
    where: { userId: session.user.id as string },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-extrabold">پشتیبانی</h1>
        <Link href="/account/support/new" className="px-5 h-10 flex items-center rounded-full text-white text-sm font-bold" style={{ background: "var(--ink)" }}>
          + تیکت جدید
        </Link>
      </div>

      {tickets.length === 0 ? (
        <p className="muted text-sm">هنوز تیکتی ثبت نکرده‌اید.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {tickets.map((t) => (
            <Link key={t.id} href={`/account/support/${t.id}`} className="flex justify-between items-center surface border line rounded-xl p-4 text-sm">
              <span className="font-medium">{t.subject}</span>
              <span className="text-xs muted">{statusLabel[t.status]}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
