import type { Metadata } from "next";
import { BrandPage } from "@/components/shop/brand-page";

export const metadata: Metadata = { title: "لوازم یدکی نیسان" };

export default function NissanPage() {
  return (
    <BrandPage
      brand="nissan"
      image="/parts/shock-absorber.svg"
      intro="قطعات اصلی (Genuine) و OEM برای مورانو، ماکسیما، اکسل، ایکس‌تریل، جوک و تیانا. از جلوبندی و کمک‌فنر تا موتور VQ35 و گیربکس CVT — با ضمانت اصالت و استعلام رایگان با شماره شاسی."
    />
  );
}
