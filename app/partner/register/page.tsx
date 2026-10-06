import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PartnerRegisterForm } from "@/components/auth/partner-register-form";
import { getCurrentUser } from "@/lib/server/auth/session";

export const metadata: Metadata = { title: "ثبت‌نام و درخواست همکاری | CaseLine", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PartnerRegisterPage() {
  if (await getCurrentUser()) redirect("/account/wholesale"); // signed-in customers apply from their account (same user, no new account)
  return (
    <main id="main" tabIndex={-1} className="login-bg grid min-h-screen place-items-center px-4 py-10">
      <PartnerRegisterForm />
    </main>
  );
}
