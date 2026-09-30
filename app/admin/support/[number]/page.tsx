import { notFound, redirect } from "next/navigation";

/** Old ticket links (notifications, bookmarks) → the ticket's new address. */
export default async function Page({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  if (!/^\d{1,9}$/.test(number)) notFound();
  redirect(`/admin/support/tickets/${number}`);
}
