import Link from "next/link";
import { db } from "@/lib/db";

export const metadata = { title: "پشتیبانی | پنل مدیریت" };

const statusLabel: Record<string, string> = { OPEN: "در انتظار پاسخ", ANSWERED: "پاسخ داده‌شده", CLOSED: "بسته‌شده" };

export default async function AdminSupportPage() {
  const tickets = await db.supportTicket.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: { user: { select: { name: true, email: true } } },
  });
  const openCount = tickets.filter((t) => t.status === "OPEN").length;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-extrabold mb-1">تیکت‌های پشتیبانی</h1>
      <p className="muted text-sm mb-6">{openCount > 0 ? `${openCount} تیکت در انتظار پاسخ.` : "همه‌ی تیکت‌ها پاسخ داده شده یا بسته‌اند."}</p>

      {tickets.length === 0 ? (
        <p className="muted text-sm">هنوز تیکتی ثبت نشده است.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {tickets.map((t) => (
            <Link key={t.id} href={`/admin/support/${t.id}`} className="flex justify-between items-center surface border line rounded-xl p-4 text-sm" style={t.status === "OPEN" ? { borderColor: "var(--ink)" } : undefined}>
              <div>
                <p className="font-medium">{t.subject}</p>
                <p className="text-xs muted mt-0.5">{t.user.name} — {t.user.email}</p>
              </div>
              <span className="text-xs font-bold">{statusLabel[t.status]}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
