"use client";
import { Fragment, useState } from "react";
import { Card, ErrorBox, ImageInput, Label, Spinner, act, btnPrimary, inputCls, useApi } from "@/components/admin/kit";
import { ResourceManager } from "@/components/admin/resource-manager";
import { cn } from "@/lib/utils";

type F = { key: string; label: string; group?: string; type?: "text" | "textarea" | "number" | "image" | "bool" | "select"; ltr?: boolean; hint?: string; options?: [string, string][] };
const SECTIONS: { key: string; title: string; desc?: string; fields: F[] }[] = [
  { key: "site", title: "هویت سایت و اطلاعات تماس", desc: "نام، شعار، لوگو و آیکون مرورگر (فاویکون) در هدر، فوتر، تب مرورگر و گوگل نمایش داده می‌شود.", fields: [
    { key: "name", label: "نام سایت", group: "هویت سایت" }, { key: "tagline", label: "شعار سایت", hint: "در عنوان تب مرورگر و نتایج گوگل کنار نام سایت می‌آید؛ هر وقت خواستید عوض کنید." }, { key: "logo", label: "لوگو (هدر و فوتر)", type: "image", hint: "تصویر افقی با پس‌زمینه شفاف (PNG یا WebP)." }, { key: "favicon", label: "آیکون مرورگر (فاویکون)", type: "image", hint: "تصویر مربعی حداقل ۱۹۲×۱۹۲ (PNG). خالی = آیکون پیش‌فرض CaseLine." },
    { key: "phone", label: "تلفن", ltr: true, group: "اطلاعات تماس، شبکه‌های اجتماعی و فوتر" }, { key: "email", label: "ایمیل", ltr: true }, { key: "address", label: "آدرس" }, { key: "hours", label: "ساعت کاری" },
    { key: "telegram", label: "تلگرام (لینک)", ltr: true }, { key: "instagram", label: "اینستاگرام (لینک)", ltr: true }, { key: "whatsapp", label: "واتساپ (لینک)", ltr: true }, { key: "aparat", label: "آپارات (لینک)", ltr: true }, { key: "youtube", label: "یوتیوب (لینک)", ltr: true },
    { key: "topBar", label: "متن نوار بالای سایت" }, { key: "footerText", label: "متن فوتر", type: "textarea" },
  ] },
  { key: "topbar", title: "نوار بالای سایت (پیام‌های چرخان)", desc: "کانال تلگرام، رهگیری سفارش، کد تخفیف و… در یک نوار باریک بالای سایت. اینجا شیوهٔ نمایش را تنظیم می‌کنید و پیام‌ها را در جدول پایین اضافه، ویرایش، فعال/غیرفعال و حذف می‌کنید. اگر هیچ پیام فعالی نباشد، همان متن ساده قبلی نمایش داده می‌شود.", fields: [
    { key: "enabled", label: "نوار بالا نمایش داده شود", type: "bool" },
    { key: "mode", label: "حالت نمایش", type: "select", options: [["auto", "خودکار (خودش می‌چرخد)"], ["manual", "دستی (کشیدن به چپ و راست / فلش)"], ["both", "خودکار + قابل کشیدن"]] },
    { key: "displaySeconds", label: "مدت نمایش هر پیام (ثانیه)", type: "number", ltr: true, hint: "۲ تا ۳۰؛ فقط در حالت خودکار" },
    { key: "transitionMs", label: "مدت انیمیشن جابه‌جایی (میلی‌ثانیه)", type: "number", ltr: true, hint: "۱۵۰ تا ۲۰۰۰؛ هرچه بیشتر، نرم‌تر و کندتر" },
    { key: "animation", label: "نوع انیمیشن (حالت خودکار)", type: "select", options: [["rise", "بالا آمدن"], ["fade", "محو شدن"], ["slide", "اسلاید افقی"]] },
    { key: "pauseOnHover", label: "با نگه‌داشتن موس/انگشت متوقف شود", type: "bool" },
  ] },
  { key: "payment", title: "اطلاعات پرداخت کارت‌به‌کارت", desc: "این اطلاعات مستقیماً در صفحه پرداخت و صفحه سفارش مشتری نمایش داده می‌شود.", fields: [
    { key: "bankName", label: "نام بانک" }, { key: "accountHolder", label: "به نام" }, { key: "cardNumber", label: "شماره کارت", ltr: true }, { key: "accountNumber", label: "شماره حساب", ltr: true }, { key: "iban", label: "شماره شبا", ltr: true }, { key: "description", label: "توضیح برای مشتری", type: "textarea" },
  ] },
  { key: "shipping", title: "تنظیمات ارسال", desc: "روش‌ها و هزینه‌ها در بخش «روش‌های ارسال» مدیریت می‌شود.", fields: [{ key: "freeThreshold", label: "آستانه پیش‌فرض ارسال رایگان (تومان)", type: "number", ltr: true }] },
  { key: "loyalty", title: "قوانین باشگاه مشتریان (امتیاز وفاداری)", desc: "امتیاز مستقل از کیف پول است. تغییر قوانین فقط روی سفارش‌های بعدی اثر دارد.", fields: [
    { key: "enabled", label: "باشگاه فعال باشد", type: "bool" },
    { key: "amountPerPoint", label: "هر چند تومان خرید کالا = ۱ امتیاز", type: "number", ltr: true },
    { key: "earnOn", label: "زمان اختصاص امتیاز", type: "select", options: [["payment", "پس از تأیید پرداخت"], ["delivery", "پس از تحویل سفارش"]] },
    { key: "minOrderTotal", label: "حداقل مبلغ کالا برای کسب امتیاز (تومان)", type: "number", ltr: true },
    { key: "redeemEnabled", label: "تبدیل امتیاز به تخفیف فعال باشد", type: "bool" },
    { key: "pointValue", label: "ارزش هر امتیاز (تومان تخفیف)", type: "number", ltr: true },
    { key: "minRedeemPoints", label: "حداقل امتیاز برای استفاده", type: "number", ltr: true },
    { key: "maxRedeemPercent", label: "حداکثر درصدی از مبلغ کالا که با امتیاز قابل پرداخت است", type: "number", ltr: true },
  ] },
  { key: "finance", title: "کنترل مالی", desc: "جداسازی وظایف: کسی که بازگشت وجه بانکی را ثبت کرده نمی‌تواند همان را تأیید کند. خاموش کردن فقط برای فروشگاه‌های تک‌نفره توصیه می‌شود.", fields: [{ key: "fourEyes", label: "تأیید بازگشت وجه بانکی توسط شخصی غیر از درخواست‌دهنده", type: "bool" }] },
  { key: "wholesalePolicy", title: "رابطهٔ قیمت عمده و خرده", desc: "هنگام ذخیرهٔ قیمت (دستی یا خودکار) بررسی می‌شود. قیمت‌های موجود تغییر نمی‌کنند؛ فقط ذخیرهٔ قیمت ناسازگار جدید رد می‌شود و قیمت خودکارِ ناسازگار اعمال نمی‌شود.", fields: [
    { key: "minDiscountPercent", label: "حداقل فاصلهٔ قیمت عمده تا خرده (٪) — ۰ یعنی «بیشتر از خرده نباشد»", type: "number", ltr: true },
    { key: "maxDiscountPercent", label: "حداکثر فاصلهٔ قیمت عمده تا خرده (٪) — ۰ یعنی بدون محدودیت", type: "number", ltr: true },
    { key: "capAtRetail", label: "همکار هرگز بیشتر از قیمت روز خرده (بعد از تخفیف) پرداخت نکند", type: "bool" },
  ] },
  { key: "general", title: "تنظیمات عمومی", fields: [{ key: "currency", label: "واحد پول" }, { key: "lowStockNotify", label: "هشدار کم‌موجودی", type: "bool" }] },
];

function Section({ s, initial }: { s: (typeof SECTIONS)[number]; initial: Record<string, unknown> }) {
  const [v, setV] = useState<Record<string, unknown>>(initial); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({}); const [dirty, setDirty] = useState(false);
  const set = (k: string, val: unknown) => { setV((o) => ({ ...o, [k]: val })); setDirty(true); };
  const save = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setErrs({}); const r = await act("PUT", `/api/admin/settings/${s.key}`, v, "تنظیمات ذخیره شد."); setBusy(false); if (r.ok) setDirty(false); else setErrs(r.fields ?? {}); };
  return (
    <Card>
      <form onSubmit={save}>
        <h2 className="text-base font-black">{s.title}</h2>{s.desc && <p className="mb-3 mt-1 text-xs text-muted">{s.desc}</p>}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {s.fields.map((f) => (
            <Fragment key={f.key}>
            {f.group && <h3 className="mt-2 border-b border-border pb-1 text-sm font-black text-primary sm:col-span-2">{f.group}</h3>}
            <Label label={f.label} hint={f.hint} error={errs[f.key]} className={cn((f.type === "textarea" || f.type === "image") && "sm:col-span-2")}>
              {f.type === "textarea" ? <textarea className={cn(inputCls, "h-24 py-2")} value={String(v[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} />
                : f.type === "image" ? <ImageInput value={(v[f.key] as string) || null} onChange={(u) => set(f.key, u ?? "")} label={f.label} />
                : f.type === "select" ? <select className={inputCls} value={String(v[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)}>{f.options?.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                : f.type === "bool" ? <span className="flex h-10 items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={!!v[f.key]} onChange={(e) => set(f.key, e.target.checked)} />فعال</span>
                : <input className={inputCls} dir={f.ltr ? "ltr" : undefined} type={f.type === "number" ? "number" : "text"} value={String(v[f.key] ?? "")} onChange={(e) => set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)} />}
            </Label>
            </Fragment>
          ))}
        </div>
        <div className="mt-4 flex justify-end"><button className={btnPrimary} disabled={busy || !dirty}>{busy ? "…" : "ذخیره"}</button></div>
      </form>
    </Card>
  );
}

export function SettingsClient() {
  const { data, error, loading } = useApi<Record<string, Record<string, unknown>>>("/api/admin/settings");
  if (error) return <ErrorBox message={error} />;
  if (loading || !data) return <Spinner />;
  return <div className="space-y-4">{SECTIONS.map((s) => <Fragment key={s.key}><Section s={s} initial={data[s.key] ?? {}} />{s.key === "topbar" && <TopBarItems />}</Fragment>)}</div>;
}

const KINDS: [string, string][] = [["telegram", "تلگرام"], ["instagram", "اینستاگرام"], ["tracking", "کانال رهگیری سفارش"], ["discount", "کد تخفیف"], ["link", "لینک / اعلان"]];
/** Rows of the rotating bar: add, edit, activate/deactivate, reorder (arrows), delete — all through the generic admin CRUD. */
function TopBarItems() {
  return (
    <div data-testid="topbar-items">
      <h3 className="mb-1 mt-2 text-sm font-black">پیام‌های نوار بالا</h3>
      <ResourceManager resource="topbar-items" noun="پیام" sortable defaults={{ isActive: true, kind: "telegram" }}
        columns={[{ key: "title", label: "عنوان" }, { key: "kind", label: "نوع", map: Object.fromEntries(KINDS) }, { key: "link", label: "لینک", kind: "code" }, { key: "copyText", label: "کد قابل کپی", kind: "code" }, { key: "isActive", label: "وضعیت", kind: "bool" }]}
        fields={[
          { key: "kind", label: "نوع پیام (آیکون)", type: "select", required: true, options: KINDS.map(([value, label]) => ({ value, label })) },
          { key: "title", label: "عنوان (مثلاً تلگرام ما)", type: "text", required: true },
          { key: "subtitle", label: "توضیح کوتاه (فقط در نمایشگرهای بزرگ‌تر)", type: "text", nullable: true },
          { key: "link", label: "لینک (مثلاً https://t.me/…)", type: "text", ltr: true, nullable: true },
          { key: "ctaLabel", label: "متن دکمه (خالی = پیش‌فرض نوع)", type: "text", nullable: true },
          { key: "copyText", label: "متن قابل کپی (کد تخفیف)", type: "text", ltr: true, nullable: true },
          { key: "startsAt", label: "شروع نمایش (اختیاری)", type: "date", nullable: true }, { key: "endsAt", label: "پایان نمایش (اختیاری)", type: "date", nullable: true },
          { key: "isActive", label: "وضعیت", type: "bool" },
        ]} />
    </div>
  );
}
