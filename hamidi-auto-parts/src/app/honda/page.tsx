import type { Metadata } from "next";
import { BrandPage } from "@/components/shop/brand-page";

export const metadata: Metadata = { title: "لوازم یدکی هوندا" };

export default function HondaPage() {
  return (
    <BrandPage
      brand="honda"
      image="/parts/timing-belt.svg"
      intro="پوشش کامل تمام مدل‌های هوندا از سال ۱۹۹۰ تا ۲۰۱۷؛ آکورد، سیویک، سی‌آر‌وی، سیتی، جاز، اودیسه، پایلوت و مدل‌های کلاسیک مانند پرلود، اینتگرا و S2000."
    />
  );
}
