import { PageHead } from "@/components/admin/kit";
import { SupportInbox } from "@/components/admin/support-client";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; user?: string; order?: string }> }) {
  await requireAdminPage(["support.read", "support.reply"], "/admin/support/tickets");
  const sp = await searchParams;
  return (<><PageHead title="تیکت‌های پشتیبانی" sub="درخواست‌های رسمی و قابل پیگیری مشتریان؛ پیوست‌ها خصوصی هستند. گفتگوهای لحظه‌ای در «چت آنلاین» هستند." /><SupportInbox key={`${sp.status}|${sp.user}|${sp.order}`} initialStatus={sp.status ?? ""} initialOrder={sp.order ?? ""} initialUser={sp.user ?? ""} /></>);
}
