import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/server/auth/session";
import { safeNext } from "@/lib/server/auth/guard";

export const metadata: Metadata = { title: "ورود به حساب کاربری | CaseLine", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { next, reset } = await searchParams;
  const target = safeNext(next);
  const token = typeof reset === "string" && /^[A-Za-z0-9_-]{20,100}$/.test(reset) ? reset : undefined;
  if (!token && (await getCurrentUser())) redirect(target);
  return (
    <main id="main" tabIndex={-1} className="login-bg grid min-h-screen place-items-center px-4 py-10">
      <LoginForm next={target} resetToken={token} />
    </main>
  );
}
