import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = { title: "صفحه پیدا نشد", robots: { index: false, follow: true } };
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-x flex flex-col items-center py-24 text-center">
      <Image src="/images/parts/brake-disc.png" alt="" width={384} height={384} sizes="192px" className="size-48 animate-spin-slow opacity-80" />
      <p className="mt-6 text-6xl font-black text-primary">۴۰۴</p>
      <h1 className="mt-2 text-2xl font-black">صفحه مورد نظر پیدا نشد</h1>
      <p className="mt-2 text-neutral-600">ممکن است آدرس اشتباه باشد یا این قطعه دیگر موجود نباشد.</p>
      <div className="mt-6 flex gap-2">
        <Button asChild><Link href="/">صفحه اصلی</Link></Button>
        <Button asChild variant="outline"><Link href="/shop">فروشگاه</Link></Button>
      </div>
    </div>
  );
}
