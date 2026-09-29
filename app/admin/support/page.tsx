import { PageHead } from "@/components/admin/kit";
import { SupportInbox } from "@/components/admin/support-client";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdminPage(["support.read", "support.reply"], "/admin/support");
  const sp = await searchParams;
  return (<><PageHead title="پشتیبانی" sub="تیکت‌های واقعی مشتریان؛ پیوست‌ها خصوصی هستند و فقط برای مشتری و کارکنان مجاز باز می‌شوند." /><SupportInbox key={sp.status} initialStatus={sp.status ?? ""} /></>);
}
