import type { Metadata } from "next";
import { Eye, Lock } from "lucide-react";
import { AccountShell } from "@/components/account-shell";

export const metadata: Metadata = { title: "اطلاعات حساب کاربری | CaseLine" };
const field = "h-12 w-full rounded-xl border border-border bg-surface px-4 text-sm outline-none focus:border-primary";
function F({ label, name, type = "text", dir }: { label: string; name: string; type?: string; dir?: "ltr" }) {
  return (
    <label className="block space-y-2 text-xs font-bold">
      <span>{label}<b className="text-hot"> *</b></span>
      <input name={name} type={type} dir={dir} className={field} />
    </label>
  );
}
function P({ label, name }: { label: string; name: string }) {
  return (
    <label className="block space-y-2 text-xs font-bold">
      <span>{label}</span>
      <span className="relative block">
        <input name={name} type="password" dir="ltr" className={`${field} ps-11`} />
        <button type="button" data-eye aria-label="نمایش رمز" className="absolute start-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted hover:text-primary"><Eye className="size-4" /></button>
      </span>
    </label>
  );
}

export default function EditAccountPage() {
  return (
    <AccountShell active="edit">
      <form data-edit-form className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2"><F label="نام" name="first" /><F label="نام خانوادگی" name="last" /></div>
        <div>
          <F label="نام نمایشی" name="display" />
          <p className="mt-2 text-[11px] text-muted">به این صورت اسم شما در حساب کاربری و نظرات دیده خواهد شد</p>
        </div>
        <F label="آدرس ایمیل" name="email" type="email" dir="ltr" />
        <fieldset className="space-y-4 rounded-2xl bg-surface-2 p-4">
          <legend className="flex items-center gap-2 px-1 text-[13px] font-black"><Lock className="size-4 text-primary" />تغییر گذرواژه</legend>
          <P label="رمز عبور پیشین (در صورتی که قصد تغییر ندارید خالی بگذارید)" name="old" />
          <P label="رمز عبور جدید (در صورتی که قصد تغییر ندارید خالی بگذارید)" name="new" />
          <P label="تایید رمز عبور جدید" name="new2" />
        </fieldset>
        <p data-edit-msg className="min-h-4 text-xs text-hot data-[ok=1]:text-success" />
        <div className="flex justify-end"><button type="submit" className="h-12 cursor-pointer rounded-xl bg-primary px-6 text-sm font-bold text-primary-fg shadow-md hover:bg-primary-hover">ذخیره تغییرات</button></div>
      </form>
    </AccountShell>
  );
}
