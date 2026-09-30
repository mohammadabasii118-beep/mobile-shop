"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/header";
import { api, safeNext, toLatin } from "@/lib/client/api";

const field = "h-12 w-full rounded-xl border border-primary/40 bg-surface px-4 text-center text-base text-foreground outline-none transition-shadow focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_20%,transparent)]";
type Step = "phone" | "otp" | "newpass";
type Purpose = "login" | "reset";

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"otp" | "password" | "register">("password");
  const [step, setStep] = useState<Step>("phone");
  const [purpose, setPurpose] = useState<Purpose>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [pass2, setPass2] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [dupEmail, setDupEmail] = useState(false);
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [ticket, setTicket] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [left, setLeft] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => clearInterval(t);
  }, [left]);

  const go = (url: string) => { window.location.href = url; };
  const destination = (needsProfile: boolean) => (needsProfile ? `/account/profile?next=${encodeURIComponent(safeNext(next))}` : safeNext(next));

  async function run<T>(p: Promise<{ ok: true; data: T } | { ok: false; error: { message: string } }>, then: (d: T) => void) {
    setErr(""); setInfo(""); setDupEmail(false); setBusy(true);
    const [r] = await Promise.all([p, new Promise((res) => setTimeout(res, 700))]); // short delay so the loading animation is visible
    setBusy(false);
    if (r.ok) then(r.data); else { setErr(r.error.message); setDupEmail((r.error as { code?: string }).code === "email_taken"); }
  }

  const sendOtp = (p: Purpose) =>
    run(api(p === "login" ? "POST" : "POST", p === "login" ? "/api/auth/otp/request" : "/api/auth/forgot", { phone }), () => {
      setPurpose(p); setStep("otp"); setDigits(["", "", "", ""]); setLeft(120);
      setTimeout(() => boxes.current[0]?.focus(), 50);
    });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (step === "phone") {
      if (mode === "register") return void run(api<{ needsProfile: boolean }>("POST", "/api/auth/register", { fullName, email, password }), (d) => go(destination(d.needsProfile)));
      if (mode === "otp") return void sendOtp("login");
      return void run(api<{ needsProfile: boolean }>("POST", "/api/auth/login", { identifier: phone, password }), (d) => go(destination(d.needsProfile)));
    }
    if (step === "otp") {
      const code = digits.join("");
      if (code.length < 4) return setErr("کد تایید ۴ رقمی را کامل وارد کنید.");
      if (purpose === "login") return void run(api<{ needsProfile: boolean }>("POST", "/api/auth/otp/verify", { phone, code }), (d) => go(destination(d.needsProfile)));
      return void run(api<{ ticket: string }>("POST", "/api/auth/forgot/verify", { phone, code }), (d) => { setTicket(d.ticket); setStep("newpass"); });
    }
    if (pass2 !== password) return setErr("تکرار رمز عبور یکسان نیست.");
    return void run(api("POST", "/api/auth/reset", { ticket, password }), () => {
      setStep("phone"); setMode("password"); setPassword(""); setPass2(""); setInfo("رمز عبور تغییر کرد. با رمز جدید وارد شوید.");
    });
  }

  function onDigit(i: number, v: string) {
    const d = toLatin(v).replace(/\D/g, "").slice(-1);
    setDigits((a) => a.map((x, k) => (k === i ? d : x)));
    if (d && boxes.current[i + 1]) boxes.current[i + 1]!.focus();
  }
  function onPaste(e: React.ClipboardEvent) {
    const t = toLatin(e.clipboardData.getData("text")).replace(/\D/g, "").slice(0, 4);
    if (!t) return;
    e.preventDefault();
    setDigits([0, 1, 2, 3].map((k) => t[k] ?? ""));
    boxes.current[Math.min(t.length, 4) - 1]?.focus();
  }

  const title = step === "newpass" ? "رمز عبور جدید" : "به پنل کاربری خوش آمدید.";
  const btn = step === "phone" ? (mode === "register" ? "ثبت‌نام" : mode === "otp" ? "ارسال کد" : "ورود") : step === "otp" ? "تایید" : "تغییر رمز عبور";

  return (
    <div data-login-card data-loading={busy} className="login-card relative w-full max-w-[330px] rounded-[28px] border border-white/60 bg-surface/70 p-6 shadow-lg backdrop-blur-xl dark:border-border">
      <div className="login-dots" aria-hidden><i /><i /><i /></div>
      <div className="login-blur">
        <Link href="/" aria-label="بازگشت به سایت" className="absolute start-4 top-4 grid size-9 place-items-center rounded-full bg-surface text-primary shadow-sm hover:bg-primary/10"><ArrowRight className="size-4" /></Link>
        <div className="flex justify-center pt-1"><Logo className="text-3xl" /></div>
        <form onSubmit={submit} className="mt-3 text-center" noValidate>
          <h1 className="text-base font-black">{title}</h1>

          {step === "phone" && mode === "register" && (
            <div>
              <p className="mt-3 text-[11.5px] leading-6 text-muted">برای ساخت حساب، نام، ایمیل و رمز عبور خود را وارد کنید.</p>
              <label htmlFor="reg-name" className="mt-5 block text-start text-xs font-bold">نام و نام خانوادگی</label>
              <input id="reg-name" name="fullName" type="text" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={`${field} mt-2`} />
              <label htmlFor="reg-email" className="mt-4 block text-start text-xs font-bold">ایمیل</label>
              <input id="reg-email" name="email" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${field} mt-2`} />
              <label htmlFor="reg-pass" className="mt-4 block text-start text-xs font-bold">رمز عبور</label>
              <input id="reg-pass" name="password" type="password" dir="ltr" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${field} mt-2`} />
              <div className="mt-3 text-[11px]"><button type="button" onClick={() => { setMode("password"); setErr(""); setDupEmail(false); }} className="cursor-pointer text-primary hover:underline">قبلاً ثبت‌نام کرده‌اید؟ ورود</button></div>
              <div className="mt-2 text-[11px]"><Link href="/partner/register" className="text-primary hover:underline">ثبت‌نام / درخواست همکاری</Link></div>
            </div>
          )}

          {step === "phone" && mode !== "register" && (
            <div>
              <p className="mt-3 text-[11.5px] leading-6 text-muted">{mode === "otp" ? "شماره موبایل ثبت‌شده در حساب خود را وارد کنید تا کد تایید برایتان ارسال شود." : "ایمیل یا شماره موبایل و رمز عبور خود را وارد کنید."}</p>
              <label htmlFor="login-phone" className="mt-5 block text-start text-xs font-bold">{mode === "otp" ? "شماره موبایل" : "ایمیل یا شماره موبایل"}</label>
              <input id="login-phone" name="phone" type={mode === "otp" ? "tel" : "text"} dir="ltr" inputMode={mode === "otp" ? "numeric" : "email"} autoComplete={mode === "otp" ? "tel" : "username"} placeholder={mode === "otp" ? "09xxxxxxxxx" : ""} value={phone} onChange={(e) => setPhone(e.target.value)} className={`${field} mt-2 ${mode === "otp" ? "tracking-widest" : ""}`} />
              {mode === "password" && (
                <>
                  <label htmlFor="login-pass" className="mt-4 block text-start text-xs font-bold">رمز عبور</label>
                  <input id="login-pass" name="password" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${field} mt-2`} />
                  <div className="mt-2 text-start"><button type="button" onClick={() => phone && !phone.includes("@") ? sendOtp("reset") : setErr(phone.includes("@") ? "بازیابی رمز عبور برای حساب‌های ایمیلی از طریق پشتیبانی انجام می‌شود." : "ابتدا شماره موبایل را وارد کنید.")} className="cursor-pointer text-[11px] text-primary hover:underline">فراموشی رمز عبور</button></div>
                </>
              )}
              <div className="mt-3 text-[11px]"><button type="button" onClick={() => { setMode(mode === "otp" ? "password" : "otp"); setErr(""); setInfo(""); }} className="cursor-pointer text-primary hover:underline">{mode === "otp" ? "ورود با رمز عبور" : "ورود با کد پیامکی"}</button></div>
              <div className="mt-2 text-[11px]"><button type="button" onClick={() => { setMode("register"); setErr(""); setInfo(""); setPassword(""); }} className="cursor-pointer text-primary hover:underline">حساب ندارید؟ ثبت‌نام</button></div>
            </div>
          )}

          {step === "otp" && (
            <div>
              <p className="mt-3 text-xs font-bold">کد تایید ارسال شده را وارد کنید</p>
              <div className="mt-3 rounded-lg bg-success/15 px-3 py-3 text-start text-xs font-medium text-success">کد تایید پیامک شد.</div>
              <span className="mt-5 block text-start text-xs font-bold">کد تایید</span>
              <div dir="ltr" className="mt-3 flex justify-center gap-2.5" onPaste={onPaste}>
                {digits.map((d, i) => (
                  <input key={i} ref={(el) => { boxes.current[i] = el; }} aria-label={`رقم ${i + 1}`} value={d} maxLength={1} inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} onChange={(e) => onDigit(i, e.target.value)} onKeyDown={(e) => { if (e.key === "Backspace" && !digits[i] && i > 0) boxes.current[i - 1]?.focus(); }}
                    className="size-12 rounded-xl border border-border bg-surface text-center text-lg font-bold text-foreground outline-none transition-shadow focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_20%,transparent)]" />
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted">
                <span>کد به شماره <b dir="ltr" className="text-foreground">{phone}</b> ارسال شد.</span>
                <button type="button" onClick={() => { setStep("phone"); setErr(""); }} className="shrink-0 cursor-pointer rounded-full bg-primary/10 px-3 py-1.5 font-bold text-primary hover:bg-primary/15">تغییر شماره ‹</button>
              </div>
              <p className="mt-3 min-h-5 text-[11px] text-muted">
                {left > 0 ? <><b className="cl-num">{left.toLocaleString("fa-IR")}</b> ثانیه مانده تا پایان اعتبار این کد</> : <button type="button" onClick={() => sendOtp(purpose)} className="cursor-pointer text-primary hover:underline">ارسال مجدد کد</button>}
              </p>
            </div>
          )}

          {step === "newpass" && (
            <div>
              <p className="mt-3 text-[11.5px] leading-6 text-muted">رمز عبور جدید را وارد کنید (حداقل ۸ کاراکتر، شامل حرف و عدد).</p>
              <input aria-label="رمز عبور جدید" type="password" dir="ltr" autoComplete="new-password" placeholder="رمز عبور جدید" value={password} onChange={(e) => setPassword(e.target.value)} className={`${field} mt-4`} />
              <input aria-label="تکرار رمز عبور" type="password" dir="ltr" autoComplete="new-password" placeholder="تکرار رمز عبور" value={pass2} onChange={(e) => setPass2(e.target.value)} className={`${field} mt-3`} />
            </div>
          )}

          <p role="alert" className="mt-2 min-h-4 text-xs text-hot">{err}{dupEmail && <> <button type="button" onClick={() => { setMode("password"); setPhone(email); setErr(""); setDupEmail(false); }} className="cursor-pointer font-bold text-primary hover:underline">ورود به حساب</button></>}</p>
          {info && <p className="text-xs text-success">{info}</p>}
          <button type="submit" disabled={busy} className="mt-2 flex h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-fg shadow-md transition-colors hover:bg-primary-hover disabled:opacity-60">{btn}</button>
          <p className="mt-6 text-[10.5px] leading-5 text-muted">با ورود یا ثبت‌نام در سایت، شما قوانین و مقررات استفاده از سایت کیس‌لاین را قبول می‌کنید.</p>
        </form>
      </div>
    </div>
  );
}
