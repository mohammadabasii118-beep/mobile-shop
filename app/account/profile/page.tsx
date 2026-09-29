import type { Metadata } from "next";

export const metadata: Metadata = { title: "تکمیل اطلاعات پروفایل | CaseLine" };
const field = "h-12 w-full rounded-xl border border-border bg-surface px-4 text-sm text-foreground outline-none transition-shadow focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_20%,transparent)]";

export default function ProfilePage() {
  return (
    <main data-account-page className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <form data-profile-form className="w-full max-w-[340px] space-y-4">
        <div className="text-center">
          <h1 className="text-lg font-black text-secondary">تکمیل اطلاعات پروفایل</h1>
          <p className="mt-2 text-[11.5px] leading-6 text-muted">برای تجربه بهتر از سایت، لطفاً نام و نام خانوادگی خود را وارد کنید.</p>
        </div>
        <label className="block space-y-2 text-xs font-bold"><span>نام<b className="text-hot"> *</b></span><input name="first" required autoComplete="given-name" className={field} /></label>
        <label className="block space-y-2 text-xs font-bold"><span>نام خانوادگی<b className="text-hot"> *</b></span><input name="last" required autoComplete="family-name" className={field} /></label>
        <div className="flex gap-3 pt-1">
          <button type="submit" className="h-12 flex-1 cursor-pointer rounded-xl bg-primary text-sm font-bold text-primary-fg shadow-md hover:bg-primary-hover">ذخیره</button>
          <button type="button" data-profile-later className="h-12 flex-1 cursor-pointer rounded-xl border border-border bg-surface-2 text-sm text-muted hover:text-foreground">بعداً</button>
        </div>
      </form>
    </main>
  );
}
