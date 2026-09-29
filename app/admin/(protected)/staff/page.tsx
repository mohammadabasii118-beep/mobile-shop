import { db } from "@/lib/db";
import NewStaffForm from "@/components/admin/StaffForm";
import StaffPermissionsRow from "@/components/admin/StaffPermissionsRow";

export const metadata = { title: "حساب‌های کارمند | پنل مدیریت" };

export default async function AdminStaffPage() {
  const staff = await db.user.findMany({ where: { role: "STAFF" }, orderBy: { createdAt: "desc" } });

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">حساب‌های کارمند</h1>
      <p className="text-sm muted mb-6 max-w-2xl">
        یک حساب کارمند فقط به بخش‌هایی از پنل مدیریت دسترسی دارد که برایش تیک زده‌اید — نه به همه‌چیز. فعلاً تنها دسترسی واقعی و اعمال‌شده «پشتیبانی و پیام‌های تماس» است؛ بقیه‌ی بخش‌های پنل (سفارش‌ها، محصولات، تنظیمات مالی و…) همچنان فقط برای حساب‌های مدیر (ADMIN) باز است. تغییر دسترسی یک کارمند از دفعه‌ی بعدی که وارد می‌شود اعمال می‌شود (نه بلافاصله روی نشست باز فعلی او).
      </p>

      <div className="mb-8"><NewStaffForm /></div>

      <div className="surface border line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="surface2 text-xs muted">
            <tr>
              <th className="p-3 text-right">کارمند</th>
              <th className="p-3 text-right">دسترسی‌ها</th>
              <th className="p-3 text-right">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <StaffPermissionsRow key={s.id} id={s.id} name={s.name} email={s.email} permissions={s.permissions} />
            ))}
            {staff.length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center muted text-sm">هنوز حساب کارمندی ساخته نشده است.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
