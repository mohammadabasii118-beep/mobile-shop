import Link from "next/link";
import { db } from "@/lib/db";
import { markAlertRead } from "@/lib/actions/automation";

export const metadata = { title: "هشدارها | پنل مدیریت" };

function timeAgo(d: Date) {
  return new Date(d).toLocaleString("fa-IR");
}

export default async function AdminAlertsPage() {
  const alerts = await db.adminAlert.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">هشدارها</h1>
      <p className="text-sm muted mb-6">این فهرست فقط از رویدادهای واقعی توسط قوانین اتوماسیون فعال ساخته می‌شود (<Link href="/admin/automation" className="font-medium" style={{ color: "#404040" }}>مدیریت قوانین</Link>) — هیچ ردیف نمونه/آزمایشی در آن نیست.</p>
      <div className="surface border line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="surface2 text-xs muted">
            <tr>
              <th className="p-3 text-right">پیام</th>
              <th className="p-3 text-right">زمان</th>
              <th className="p-3 text-right">وضعیت</th>
              <th className="p-3 text-right">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id} className="border-t line" style={{ opacity: a.isRead ? 0.6 : 1 }}>
                <td className="p-3">
                  {a.link ? <Link href={a.link} className="font-medium" style={{ color: "#404040" }}>{a.message}</Link> : a.message}
                </td>
                <td className="p-3 muted">{timeAgo(a.createdAt)}</td>
                <td className="p-3">{a.isRead ? "خوانده‌شده" : "خوانده‌نشده"}</td>
                <td className="p-3">
                  <form action={async () => { "use server"; await markAlertRead(a.id, !a.isRead); }}>
                    <button className="text-xs font-medium" style={{ color: "#404040" }}>{a.isRead ? "علامت‌گذاری به‌عنوان خوانده‌نشده" : "علامت‌گذاری به‌عنوان خوانده‌شده"}</button>
                  </form>
                </td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center muted text-sm">هنوز هیچ هشداری ساخته نشده است.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
