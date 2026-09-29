import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getMyPartnerApplications } from "@/lib/actions/partners";
import PartnerApplyForm from "@/components/PartnerApplyForm";

export const metadata = { title: "همکاری در فروش (عمده/نمایندگی)" };

const statusLabel: Record<string, string> = {
  PENDING: "در انتظار بررسی",
  APPROVED: "تأیید شده",
  REJECTED: "رد شده",
};

export default async function PartnersPage() {
  const session = await getServerSession(authOptions);
  const applications = session ? await getMyPartnerApplications() : [];
  const hasPending = applications.some((a) => a.status === "PENDING");
  const isApproved = applications.some((a) => a.status === "APPROVED");

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-14">
      <h1 className="text-2xl font-extrabold mb-2 text-center">همکاری عمده‌فروشی و نمایندگی</h1>
      <p className="muted text-sm text-center mb-8 leading-7">
        اگر فروشگاه لوازم موبایل دارید یا به‌صورت عمده خرید می‌کنید، فرم زیر را پر کنید تا تیم فروش کیس‌لاین با شما تماس بگیرد.
        این یک همکاری مستقل از سیستم بازاریابی وابسته (Affiliate) است.
      </p>

      {isApproved && (
        <div className="rounded-xl p-4 text-sm mb-6 text-center" style={{ background: "#e8f3ec", color: "#3a7a4e" }}>
          حساب کاربری شما به‌عنوان همکار/نماینده تأیید شده است.
        </div>
      )}

      {!session ? (
        <div className="surface border line rounded-2xl p-6 text-center">
          <p className="text-sm mb-4">برای ارسال درخواست همکاری، ابتدا باید وارد حساب کاربری خود شوید.</p>
          <Link href="/login" className="inline-block px-6 h-11 leading-[44px] rounded-full text-white font-bold text-sm" style={{ background: "var(--ink)" }}>
            ورود به حساب
          </Link>
        </div>
      ) : hasPending ? (
        <div className="surface border line rounded-2xl p-6 text-center">
          <p className="font-bold text-sm mb-1">درخواست شما در انتظار بررسی است</p>
          <p className="muted text-sm">به‌زودی نتیجه اطلاع‌رسانی می‌شود.</p>
        </div>
      ) : (
        <PartnerApplyForm />
      )}

      {applications.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold mb-3">تاریخچه‌ی درخواست‌های شما</h2>
          <div className="flex flex-col gap-2">
            {applications.map((a) => (
              <div key={a.id} className="flex justify-between items-center surface border line rounded-xl p-3 text-sm">
                <span>{new Date(a.createdAt).toLocaleDateString("fa-IR")}</span>
                <span className="font-medium">{statusLabel[a.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
