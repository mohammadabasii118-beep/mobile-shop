import { PageHead } from "@/components/admin/kit";
import { ReviewsClient } from "@/components/admin/reviews-client";
import { requireAdminPage } from "@/lib/server/admin/page";

export default async function Page() {
  await requireAdminPage("review.moderate", "/admin/reviews");
  return (<><PageHead title="نظرات کاربران" sub="فقط نظرات تأییدشده در صفحه محصول نمایش داده می‌شود." /><ReviewsClient /></>);
}
