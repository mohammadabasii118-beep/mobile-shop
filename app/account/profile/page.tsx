import type { Metadata } from "next";
import { ProfileForm } from "@/components/account/profile-form";
import { requirePageUser, safeNext } from "@/lib/server/auth/guard";

export const metadata: Metadata = { title: "تکمیل اطلاعات پروفایل | CaseLine", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await requirePageUser("/account/profile");
  return (
    <main id="main" className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <ProfileForm next={safeNext(next)} firstName={user.firstName ?? ""} lastName={user.lastName ?? ""} />
    </main>
  );
}
