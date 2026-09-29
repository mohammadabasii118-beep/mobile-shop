import { db } from "@/lib/db";
import ContactMessageRow from "@/components/admin/ContactMessageRow";

export const metadata = { title: "پیام‌های تماس با ما | پنل مدیریت" };

export default async function AdminContactMessagesPage() {
  const messages = await db.contactMessage.findMany({ orderBy: { createdAt: "desc" } });
  const unreadCount = messages.filter((m) => !m.isRead).length;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-extrabold mb-1">پیام‌های تماس با ما</h1>
      <p className="muted text-sm mb-6">پیام‌های ارسال‌شده از فرم عمومی «تماس با ما» (`/contact`). {unreadCount > 0 ? `${unreadCount} پیام خوانده‌نشده.` : "همه خوانده شده‌اند."}</p>

      {messages.length === 0 ? (
        <p className="muted text-sm">هنوز پیامی از فرم تماس با ما دریافت نشده است.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {messages.map((m) => <ContactMessageRow key={m.id} message={m} />)}
        </div>
      )}
    </div>
  );
}
