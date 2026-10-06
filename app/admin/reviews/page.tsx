import { PageHead } from "@/components/admin/kit";
import { ReviewsClient } from "@/components/admin/reviews-client";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; productId?: string }> }) {
  await requireAdminPage("review.moderate", "/admin/reviews");
  const sp = await searchParams;
  const status = ["pending", "approved", "rejected"].includes(sp.status ?? "") ? sp.status! : "pending";
  return (<><PageHead title="نظرات کاربران" sub="فقط نظرات تأییدشده در صفحه محصول و صفحه اصلی نمایش داده می‌شود." /><ReviewsClient initialStatus={status} initialProductId={sp.productId ?? ""} /></>);
}
