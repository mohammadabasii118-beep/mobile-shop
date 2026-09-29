import { db } from "@/lib/db";
import AutomationRuleForm from "@/components/admin/AutomationRuleForm";
import { toggleAutomationRule, deleteAutomationRule } from "@/lib/actions/automation";

export const metadata = { title: "اتوماسیون | پنل مدیریت" };

const triggerLabel: Record<string, string> = {
  ORDER_DELIVERED: "سفارش تحویل داده شد",
  NEW_SUPPORT_TICKET: "تیکت پشتیبانی جدید",
  NEW_CONTACT_MESSAGE: "پیام تماس جدید",
  LOW_STOCK: "موجودی یک محصول کم شد",
};
const actionLabel: Record<string, string> = {
  CREATE_ADMIN_ALERT: "ساخت هشدار برای مدیر",
  GRANT_LOYALTY_BONUS: "اعطای امتیاز وفاداری پاداشی",
};

export default async function AdminAutomationPage() {
  const rules = await db.automationRule.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">اتوماسیون (بدون‌کد)</h1>
      <p className="text-sm muted mb-6 max-w-2xl">
        یک قانون یعنی: «وقتی این رویداد واقعی در سایت رخ داد، این کار واقعی را انجام بده» — بدون نوشتن کد. فعلاً فقط دو نوع کار پشتیبانی می‌شود، چون هیچ سرویس ایمیل/پیامک واقعی به این پروژه متصل نیست: <b>ساخت هشدار داخلی برای مدیر</b> و <b>اعطای امتیاز وفاداری پاداشی</b> (فقط روی رویداد تحویل سفارش). هیچ کار «ارسال ایمیل/پیامک» وجود ندارد تا وعده‌ای داده نشود که عملاً اجرا نمی‌شود.
      </p>

      <div className="mb-8"><AutomationRuleForm /></div>

      <div className="surface border line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="surface2 text-xs muted">
            <tr>
              <th className="p-3 text-right">نام</th>
              <th className="p-3 text-right">رویداد</th>
              <th className="p-3 text-right">کار</th>
              <th className="p-3 text-right">وضعیت</th>
              <th className="p-3 text-right">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t line">
                <td className="p-3 font-medium">{r.name}</td>
                <td className="p-3 muted">{triggerLabel[r.trigger]}</td>
                <td className="p-3 muted">
                  {actionLabel[r.action]}
                  {r.action === "GRANT_LOYALTY_BONUS" && (r.actionConfig as any)?.points ? ` (${(r.actionConfig as any).points} امتیاز)` : ""}
                </td>
                <td className="p-3">{r.isActive ? "فعال" : "غیرفعال"}</td>
                <td className="p-3 flex gap-3">
                  <form action={async () => { "use server"; await toggleAutomationRule(r.id, !r.isActive); }}>
                    <button className="text-xs font-medium" style={{ color: "#404040" }}>{r.isActive ? "غیرفعال کن" : "فعال کن"}</button>
                  </form>
                  <form action={async () => { "use server"; await deleteAutomationRule(r.id); }}>
                    <button className="text-xs" style={{ color: "#a24e56" }}>حذف</button>
                  </form>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center muted text-sm">هنوز قانونی ساخته نشده است.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
