import type { Metadata } from "next";
import { AutomationDetailPage } from "@/modules/automations/automation-detail-page";

export const metadata: Metadata = { title: "Automation" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <AutomationDetailPage id={(await params).id} />;
}
