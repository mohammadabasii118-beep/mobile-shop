import type { Metadata } from "next";
import { AccountShell } from "@/components/account-shell";
import { ChatThread } from "@/components/account/chat";
import { requirePageUser } from "@/lib/server/auth/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "چت آنلاین | CaseLine", robots: { index: false } };

export default async function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageUser(`/account/chat/${id}`);
  return <AccountShell active="chat"><ChatThread id={id} /></AccountShell>;
}
