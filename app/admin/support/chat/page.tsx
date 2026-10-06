import { PageHead } from "@/components/admin/kit";
import { ChatConsole } from "@/components/admin/chat-console";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; open?: string }> }) {
  const u = await requireAdminPage(["chat.read", "chat.reply"], "/admin/support/chat");
  const sp = await searchParams;
  return (<><PageHead title="چت آنلاین" sub="گفتگوهای لحظه‌ای با مشتریان. برای پیگیری رسمی از داخل گفتگو «ایجاد تیکت» بزنید؛ گفتگو همچنان چت می‌ماند." />
    <ChatConsole initialTab={sp.tab ?? "open"} initialOpen={sp.open ?? ""} canReply={u.permissions.includes("chat.reply")} canTicket={u.permissions.includes("chat.reply") && u.permissions.includes("support.reply")} /></>);
}
