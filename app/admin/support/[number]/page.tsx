import { notFound } from "next/navigation";
import { PageHead } from "@/components/admin/kit";
import { TicketDetail } from "@/components/admin/support-client";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const u = await requireAdminPage(["support.read", "support.reply"], `/admin/support/${number}`);
  if (!/^\d{1,9}$/.test(number)) notFound();
  return (<><PageHead title={`تیکت #${Number(number).toLocaleString("fa-IR", { useGrouping: false })}`} /><TicketDetail number={Number(number)} canReply={u.permissions.includes("support.reply")} /></>);
}
