import { redirect } from "next/navigation";

/** Support is two separate systems; the old single entry point goes to the tickets list (old links keep working). */
export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  redirect(`/admin/support/tickets${sp.status ? `?status=${encodeURIComponent(sp.status)}` : ""}`);
}
