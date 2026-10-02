"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { APP_NAME, DEMO_CREDENTIALS } from "@/config/app";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { apiFetch } from "@/hooks/api";
import { LanguageSwitch } from "@/i18n/language-switch";
import { useT } from "@/i18n/provider";

export default function LoginPage() {
  const router = useRouter();
  const t = useT();
  const [email, setEmail] = useState(DEMO_CREDENTIALS.email);
  const [password, setPassword] = useState(DEMO_CREDENTIALS.password);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await apiFetch("/api/auth/login", { method: "POST", json: { email, password } });
      router.replace("/dashboard");
    } catch (err) {
      setError(t((err as Error).message));
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="rounded-lg bg-primary p-2 text-primary-foreground"><Sparkles className="size-5" /></div>
          <span className="text-xl font-semibold">{APP_NAME}</span>
          <span className="ms-auto"><LanguageSwitch /></span>
        </div>
        <h1 className="text-lg font-semibold">{t("Sign in")}</h1>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">{t("Telegram & Instagram automation panel")}</p>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></Field>
          <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={loading} size="lg">{t("Sign in")}</Button>
        </form>
        <div className="mt-5 rounded-lg bg-accent p-3 text-xs text-primary">
          🟣 <b>{t("DEMO MODE")}</b> — {t("credentials are pre-filled:")}<br />{DEMO_CREDENTIALS.email} / {DEMO_CREDENTIALS.password}
        </div>
      </div>
    </main>
  );
}
