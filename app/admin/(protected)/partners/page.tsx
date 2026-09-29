import { db } from "@/lib/db";
import PartnerReviewActions from "@/components/admin/PartnerReviewActions";

const statusLabel: Record<string, string> = { PENDING: "در انتظار بررسی", APPROVED: "تأیید شده", REJECTED: "رد شده" };

export default async function AdminPartnersPage() {
  const applications = await db.partnerApplication.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true, phone: true, isWholesale: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">درخواست‌های همکاری (عمده/نمایندگی)</h1>
      <p className="text-sm muted mb-6">
        تأیید یک درخواست، حساب کاربری متقاضی را به‌عنوان همکار (Wholesale) علامت می‌زند. توجه: این نسخه فقط گردش‌کار درخواست/تأیید را پیاده‌سازی کرده — قیمت‌گذاری عمده و پنل اختصاصی همکاران هنوز پیاده نشده (به PROGRESS.md مراجعه کنید).
      </p>

      <div className="flex flex-col gap-4">
        {applications.map((a) => (
          <div key={a.id} className="surface border line rounded-2xl p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
            <div className="flex-1 min-w-0 text-sm">
              <div className="font-bold">
                {a.user.name} {a.user.isWholesale && <span className="text-xs font-normal muted">(همکار تأییدشده)</span>}
              </div>
              <div className="muted">{a.user.email} — {a.phone}</div>
              {a.companyName && <div className="muted">شرکت/فروشگاه: {a.companyName}</div>}
              {a.city && <div className="muted">شهر: {a.city}</div>}
              <p className="mt-2 leading-6">{a.message}</p>
              <div className="muted text-xs mt-2">
                تاریخ ثبت: {new Date(a.createdAt).toLocaleString("fa-IR")} · وضعیت: {statusLabel[a.status]}
                {a.status !== "PENDING" && a.reviewNote ? ` (${a.reviewNote})` : ""}
              </div>
            </div>
            <div className="shrink-0">
              {a.status === "PENDING" ? (
                <PartnerReviewActions applicationId={a.id} />
              ) : (
                <span
                  className="text-xs px-3 py-1.5 rounded-full"
                  style={{ background: a.status === "APPROVED" ? "var(--surface-2)" : "#f6eae6", color: a.status === "APPROVED" ? "var(--text)" : "#a24e56" }}
                >
                  {statusLabel[a.status]}
                </span>
              )}
            </div>
          </div>
        ))}
        {applications.length === 0 && <p className="surface border line rounded-2xl p-6 text-center muted text-sm">هنوز درخواستی ثبت نشده است.</p>}
      </div>
    </div>
  );
}
