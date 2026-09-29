import { getMyTwoFactorStatus } from "@/lib/actions/twoFactor";
import TwoFactorPanel from "@/components/admin/TwoFactorPanel";

export const metadata = { title: "امنیت حساب | پنل مدیریت" };

export default async function AdminSecurityPage() {
  const { enabled } = await getMyTwoFactorStatus();

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">امنیت حساب (ورود دو مرحله‌ای)</h1>
      <p className="text-sm muted mb-6 max-w-2xl">
        این تنظیم فقط روی حساب خودتان اثر می‌گذارد. وقتی فعال باشد، بعد از وارد کردن ایمیل/رمز عبور در ورود پنل مدیریت، یک کد ۶ رقمی هم از شما خواسته می‌شود.
      </p>
      <TwoFactorPanel initiallyEnabled={enabled} />
    </div>
  );
}
