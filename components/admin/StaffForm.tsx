"use client";
import { createStaffAccount } from "@/lib/actions/staff";
import { STAFF_PERMISSIONS } from "@/lib/permissions";

export default function NewStaffForm() {
  return (
    <form action={createStaffAccount} className="grid gap-4 max-w-lg surface border line rounded-2xl p-5">
      <div>
        <label className="text-sm font-medium block mb-1">نام</label>
        <input name="name" required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">ایمیل</label>
        <input name="email" type="email" required className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">رمز عبور موقت</label>
        <input name="password" type="password" required minLength={6} className="w-full h-11 rounded-lg border line bg-transparent px-3 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-2">دسترسی‌ها</label>
        <div className="flex flex-col gap-2">
          {STAFF_PERMISSIONS.map((p) => (
            <label key={p.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="permissions" value={p.key} /> {p.label}
            </label>
          ))}
        </div>
      </div>
      <button className="px-8 h-11 rounded-full text-white font-bold text-sm w-fit" style={{ background: "var(--ink)" }}>ساخت حساب کارمند</button>
    </form>
  );
}
